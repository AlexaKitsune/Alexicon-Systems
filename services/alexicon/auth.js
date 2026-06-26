const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const pool = require('../../utils/db_conn');
const { getTokenFromReq, authRequired } = require('../../utils/auth');
const { asyncRoute } = require('../../utils/route');

const router = express.Router();

function createJwt(userId) {
    const jti = crypto.randomUUID();
    const expiresIn = '7d';

    const token = jwt.sign(
        { sub: String(userId), jti },
        process.env.JWT_SECRET_KEY,
        {
            algorithm: 'HS256',
            expiresIn
        }
    );

    return { token, jti };
}

function createVerifyKey() {
    return crypto.randomBytes(32).toString('hex');
}

function cleanText(value, max = 63) {
    const text = String(value || '').trim().replace(/\s+/g, ' ')
    return text.length ? text.slice(0, max) : ''
}

function cleanAtSign(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^@+/, '')
}

function isValidAtSign(value) {
    return /^[a-z0-9_]{3,32}$/.test(value)
}

// POST /alexicon/auth/register
router.post('/register', asyncRoute(async (req, res) => {
    const {
        name,
        surname,
        nickname,
        at_sign,
        birthday,
        gender,
        description,
        email,
        password,
        origin
    } = req.body;

    const cleanName = cleanText(name)
    const cleanSurname = cleanText(surname)
    const cleanNickname = cleanText(nickname)
    const cleanAt = cleanAtSign(at_sign)
    const cleanDescription = description ? cleanText(description, 255) : null
    const cleanEmail = String(email || '').trim().toLowerCase()
    const cleanPassword = String(password || '')

    if (
        !cleanName ||
        !cleanSurname ||
        !cleanNickname ||
        !cleanAt ||
        !birthday ||
        !gender ||
        !cleanEmail ||
        !cleanPassword
    ) {
        return res.status(400).json({
            status: 'error',
            message: 'Faltan campos obligatorios.'
        })
    }

    if (!isValidAtSign(cleanAt)) {
        return res.status(400).json({
            status: 'error',
            message: 'El @ debe tener 3 a 32 caracteres y sólo puede usar letras, números o guion bajo.'
        })
    }

    if (cleanPassword.length < 6) {
        return res.status(400).json({
            status: 'error',
            message: 'La contraseña debe tener al menos 6 caracteres.'
        })
    }

    const [existing] = await pool.execute(
        `SELECT id, email, at_sign
        FROM users
        WHERE email = ? OR LOWER(at_sign) = ?
        LIMIT 1`,
        [cleanEmail, cleanAt]
    )

    if (existing.length) {
        return res.status(409).json({
            status: 'error',
            message: existing[0].email === cleanEmail
                ? 'Ese correo ya está registrado.'
                : 'Ese @ ya está registrado.'
        })
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 12);
    const verifyKey = createVerifyKey();

    const [result] = await pool.execute(
        `INSERT INTO users
         (name, surname, nickname, at_sign, birthday, gender, description, email, password, verify_key, origin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            cleanName,
            cleanSurname,
            cleanNickname,
            cleanAt,
            birthday,
            gender,
            cleanDescription,
            cleanEmail,
            hashedPassword,
            verifyKey,
            origin || null
        ]
    );

    await pool.execute(
        `INSERT INTO settings (user_id, chosen_name, language)
        VALUES (?, ?, ?)`,
        [
            result.insertId,
            cleanName,
            'en'
        ]
    );

    return res.status(201).json({
        status: 'success',
        message: 'Usuario registrado correctamente.',
        data: {
            user_id: result.insertId,
            verify_key: verifyKey
        }
    });
}));

// POST /alexicon/auth/login
router.post('/login', asyncRoute(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Correo y contraseña son obligatorios.'
        });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const [rows] = await pool.execute(
        `SELECT id, email, password, verified
         FROM users
         WHERE email = ?
         LIMIT 1`,
        [cleanEmail]
    );

    if (!rows.length) {
        return res.status(401).json({
            status: 'error',
            message: 'Credenciales inválidas.'
        });
    }

    const user = rows[0];

    const validPassword = await bcrypt.compare(password, user.password || '');

    if (!validPassword) {
        return res.status(401).json({
            status: 'error',
            message: 'Credenciales inválidas.'
        });
    }

    const { token, jti } = createJwt(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await pool.execute(
        `INSERT INTO active_tokens (jti, user_id, expires_at)
         VALUES (?, ?, ?)`,
        [jti, user.id, expiresAt]
    );

    return res.json({
        status: 'success',
        message: 'Sesión iniciada.',
        data: {
            token,
            user_id: user.id,
            verified: !!user.verified
        }
    });
}));

// POST /alexicon/auth/logout
router.post('/logout', authRequired, asyncRoute(async (req, res) => {
    const token = getTokenFromReq(req);

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY, {
        algorithms: ['HS256']
    });

    await pool.execute(
        'DELETE FROM active_tokens WHERE jti = ?',
        [decoded.jti]
    );

    return res.json({
        status: 'success',
        message: 'Sesión cerrada.'
    });
}));

// GET /alexicon/auth/session
router.get('/session', authRequired, asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(
        `SELECT id, name, surname, nickname, at_sign, email, profile_pic, cover_pic, verified, type
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [req.userId]
    );

    if (!rows.length) {
        return res.status(401).json({
            status: 'error',
            message: 'Usuario no encontrado.'
        });
    }

    return res.json({
        status: 'success',
        data: rows[0]
    });
}));

// POST /alexicon/auth/verify-email
router.post('/verify-email', asyncRoute(async (req, res) => {
    const { email, verify_key } = req.body;

    if (!email || !verify_key) {
        return res.status(400).json({
            status: 'error',
            message: 'Correo y código de verificación son obligatorios.'
        });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const [result] = await pool.execute(
        `UPDATE users
         SET verified = 1, verify_key = NULL
         WHERE email = ?
           AND verify_key = ?
         LIMIT 1`,
        [cleanEmail, verify_key]
    );

    if (!result.affectedRows) {
        return res.status(400).json({
            status: 'error',
            message: 'Código de verificación inválido.'
        });
    }

    return res.json({
        status: 'success',
        message: 'Correo verificado correctamente.'
    });
}));

// POST /alexicon/auth/verify-resend
router.post('/verify-resend', asyncRoute(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({
            status: 'error',
            message: 'Correo requerido.'
        });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const verifyKey = createVerifyKey();

    const [result] = await pool.execute(
        `UPDATE users
         SET verify_key = ?
         WHERE email = ?
           AND verified = 0
         LIMIT 1`,
        [verifyKey, cleanEmail]
    );

    if (!result.affectedRows) {
        return res.status(404).json({
            status: 'error',
            message: 'Usuario no encontrado o ya verificado.'
        });
    }

    return res.json({
        status: 'success',
        message: 'Nuevo código generado.',
        data: {
            verify_key: verifyKey
        }
    });
}));

module.exports = router;