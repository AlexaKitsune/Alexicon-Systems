const express = require('express');
const bcrypt = require('bcrypt');

const pool = require('../../utils/db_conn');
const { authRequired, authOptional } = require('../../utils/auth');
const { asyncRoute } = require('../../utils/route');

const router = express.Router();

function validId(id) {
    return Number.isFinite(id) && id > 0;
}

function publicUserFields() {
    return `
        u.id, u.name, u.surname, u.nickname, u.at_sign, u.birthday, u.gender,
        u.description, u.profile_pic, u.cover_pic, u.type,
        u.followers_count, u.following_count, u.posts_count,
        u.registration_date, u.verified
    `;
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

// GET /alexicon/users/me
router.get('/me', authRequired, asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(
        `SELECT ${publicUserFields()}, u.email, u.services, s.*
        FROM users u
        LEFT JOIN settings s ON s.user_id = u.id
        WHERE u.id = ?
        LIMIT 1`,
        [req.userId]
    );

    if (!rows.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Usuario no encontrado.'
        });
    }

    return res.json({
        status: 'success',
        data: rows[0]
    });
}));

// GET /alexicon/users/at/:at
router.get('/at/:at', authOptional, asyncRoute(async (req, res) => {
    const at = String(req.params.at || '').replace(/^@/, '').trim().toLowerCase()

    if (!at) {
        return res.status(400).json({
            status: 'error',
            message: '@ inválido.'
        })
    }

    const [rows] = await pool.execute(
        `SELECT ${publicUserFields()}
         FROM users u
         WHERE LOWER(u.at_sign) = ?
         LIMIT 1`,
        [at]
    )

    if (!rows.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Usuario no encontrado.'
        })
    }

    return res.json({
        status: 'success',
        data: rows[0]
    })
}))

// GET /alexicon/users/:id
router.get('/:id', authOptional, asyncRoute(async (req, res) => {
    const userId = Number(req.params.id);

    if (!validId(userId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const [rows] = await pool.execute(
        `SELECT ${publicUserFields()}
        FROM users u
        WHERE u.id = ?
        LIMIT 1`,
        [userId]
    );

    if (!rows.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Usuario no encontrado.'
        });
    }

    let viewer = {
        following: false,
        blocked_by_me: false,
        blocks_me: false
    };

    if (req.userId) {
        const [followRows] = await pool.execute(
            `SELECT 1 FROM follows
             WHERE follower_id = ? AND followed_id = ?
             LIMIT 1`,
            [req.userId, userId]
        );

        const [blockRows] = await pool.execute(
            `SELECT blocker_id, blocked_id
             FROM blocks
             WHERE (blocker_id = ? AND blocked_id = ?)
                OR (blocker_id = ? AND blocked_id = ?)`,
            [req.userId, userId, userId, req.userId]
        );

        viewer.following = !!followRows.length;
        viewer.blocked_by_me = blockRows.some(b => b.blocker_id === req.userId);
        viewer.blocks_me = blockRows.some(b => b.blocker_id === userId);
    }

    return res.json({
        status: 'success',
        data: {
            ...rows[0],
            viewer
        }
    });
}));

// PATCH /alexicon/users/me/profile
router.patch('/me/profile', authRequired, asyncRoute(async (req, res) => {
    const updates = []
    const values = []
    let cleanNameForSettings = null

    if (req.body.name !== undefined) {
        const cleanName = cleanText(req.body.name)
    
        if (!cleanName) {
            return res.status(400).json({
                status: 'error',
                message: 'El nombre no puede estar vacío.'
            })
        }

        cleanNameForSettings = cleanName

        updates.push('name = ?')
        values.push(cleanName)
    }

    if (req.body.surname !== undefined) {
        const cleanSurname = cleanText(req.body.surname)

        if (!cleanSurname) {
            return res.status(400).json({
                status: 'error',
                message: 'El apellido no puede estar vacío.'
            })
        }

        updates.push('surname = ?')
        values.push(cleanSurname)
    }

    if (req.body.nickname !== undefined) {
        const cleanNickname = cleanText(req.body.nickname)

        if (!cleanNickname) {
            return res.status(400).json({
                status: 'error',
                message: 'El nickname no puede estar vacío.'
            })
        }

        updates.push('nickname = ?')
        values.push(cleanNickname)
    }

    if (req.body.at_sign !== undefined) {
        const cleanAt = cleanAtSign(req.body.at_sign)

        if (!isValidAtSign(cleanAt)) {
            return res.status(400).json({
                status: 'error',
                message: 'El @ debe tener 3 a 32 caracteres y sólo puede usar letras, números o guion bajo.'
            })
        }

        const [existingAt] = await pool.execute(
            `SELECT id
             FROM users
             WHERE LOWER(at_sign) = ?
               AND id != ?
             LIMIT 1`,
            [cleanAt, req.userId]
        )

        if (existingAt.length) {
            return res.status(409).json({
                status: 'error',
                message: 'Ese @ ya está registrado.'
            })
        }

        updates.push('at_sign = ?')
        values.push(cleanAt)
    }

    if (req.body.birthday !== undefined) {
        if (!req.body.birthday) {
            return res.status(400).json({
                status: 'error',
                message: 'La fecha de nacimiento no puede estar vacía.'
            })
        }

        updates.push('birthday = ?')
        values.push(req.body.birthday)
    }

    if (req.body.gender !== undefined) {
        const cleanGender = cleanText(req.body.gender, 255)

        if (!cleanGender) {
            return res.status(400).json({
                status: 'error',
                message: 'El género no puede estar vacío.'
            })
        }

        updates.push('gender = ?')
        values.push(cleanGender)
    }

    if (req.body.description !== undefined) {
        const cleanDescription = cleanText(req.body.description, 255)

        updates.push('description = ?')
        values.push(cleanDescription || null)
    }

    if (req.body.services !== undefined) {
        updates.push('services = ?')
        values.push(JSON.stringify(req.body.services || {}))
    }

    if (!updates.length) {
        return res.status(400).json({
            status: 'error',
            message: 'No hay campos para actualizar.'
        })
    }

    values.push(req.userId)

    await pool.execute(
        `UPDATE users
         SET ${updates.join(', ')}
         WHERE id = ?
         LIMIT 1`,
        values
    )

    if (cleanNameForSettings !== null) {
        await pool.execute(
            `UPDATE settings
            SET chosen_name = ?
            WHERE user_id = ?
            LIMIT 1`,
            [cleanNameForSettings, req.userId]
        )
    }

    return res.json({
        status: 'success',
        message: 'Perfil actualizado correctamente.'
    })
}))

// PATCH /alexicon/users/me/password
router.patch('/me/password', authRequired, asyncRoute(async (req, res) => {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
        return res.status(400).json({
            status: 'error',
            message: 'Contraseña actual y nueva contraseña son obligatorias.'
        });
    }

    if (String(new_password).length < 8) {
        return res.status(400).json({
            status: 'error',
            message: 'La nueva contraseña debe tener al menos 8 caracteres.'
        });
    }

    const [rows] = await pool.execute(
        `SELECT password
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [req.userId]
    );

    if (!rows.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Usuario no encontrado.'
        });
    }

    const validPassword = await bcrypt.compare(current_password, rows[0].password || '');

    if (!validPassword) {
        return res.status(401).json({
            status: 'error',
            message: 'La contraseña actual no es correcta.'
        });
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);

    await pool.execute(
        `UPDATE users
         SET password = ?
         WHERE id = ?
         LIMIT 1`,
        [hashedPassword, req.userId]
    );

    return res.json({
        status: 'success',
        message: 'Contraseña actualizada correctamente.'
    });
}));

// POST /alexicon/users/me/avatar
router.post('/me/avatar', authRequired, asyncRoute(async (req, res) => {
    const { file_id, profile_pic } = req.body;

    if (!file_id && !profile_pic) {
        return res.status(400).json({
            status: 'error',
            message: 'Debes enviar file_id o profile_pic.'
        });
    }

    let value = profile_pic || null;

    if (file_id) {
        const [files] = await pool.execute(
            `SELECT id
             FROM files
             WHERE id = ?
             LIMIT 1`,
            [Number(file_id)]
        );

        if (!files.length) {
            return res.status(404).json({
                status: 'error',
                message: 'Archivo no encontrado.'
            });
        }

        value = `/alexicon/media/${Number(file_id)}`;
    }

    await pool.execute(
        `UPDATE users
         SET profile_pic = ?
         WHERE id = ?
         LIMIT 1`,
        [value, req.userId]
    );

    return res.json({
        status: 'success',
        message: 'Avatar actualizado correctamente.',
        data: {
            profile_pic: value
        }
    });
}));

// POST /alexicon/users/me/cover
router.post('/me/cover', authRequired, asyncRoute(async (req, res) => {
    const { file_id, cover_pic } = req.body;

    if (!file_id && !cover_pic) {
        return res.status(400).json({
            status: 'error',
            message: 'Debes enviar file_id o cover_pic.'
        });
    }

    let value = cover_pic || null;

    if (file_id) {
        const [files] = await pool.execute(
            `SELECT id
             FROM files
             WHERE id = ?
             LIMIT 1`,
            [Number(file_id)]
        );

        if (!files.length) {
            return res.status(404).json({
                status: 'error',
                message: 'Archivo no encontrado.'
            });
        }

        value = `/alexicon/media/${Number(file_id)}`;
    }

    await pool.execute(
        `UPDATE users
         SET cover_pic = ?
         WHERE id = ?
         LIMIT 1`,
        [value, req.userId]
    );

    return res.json({
        status: 'success',
        message: 'Cover actualizado correctamente.',
        data: {
            cover_pic: value
        }
    });
}));

module.exports = router;