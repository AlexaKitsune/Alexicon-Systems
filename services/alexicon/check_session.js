// services/alexicon/check_session.js
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../../utils/dbConn');
require('dotenv').config();

const router = express.Router();

/**
 * GET /alexicon/check_session
 * Header: Authorization: Bearer <token>
 * Respuestas:
 *  - 200 { status:"ok", user_id, exp, now }
 *  - 401 { status:"error", message:"..." }
 */
router.get('/check_session', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ status: 'error', message: 'Missing or invalid token.' });
        }

        const token = authHeader.slice(7).trim();
        if (!token) {
            return res.status(401).json({ status: 'error', message: 'Missing or invalid token.' });
        }

        // 1) Verificar firma + exp del JWT
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        } catch {
            return res.status(401).json({ status: 'error', message: 'Invalid or expired token.' });
        }

        const userIdRaw = decoded?.sub;
        const userId = Number(userIdRaw);
        const jti = decoded?.jti;

        if (!Number.isFinite(userId) || userId <= 0 || !jti) {
            return res.status(401).json({ status: 'error', message: 'Invalid token payload.' });
        }

        // 2) Confirmar que el token siga activo y no esté vencido en DB (UTC)
        const [rows] = await pool.execute(
            `
            SELECT 1
            FROM active_tokens
            WHERE jti = ?
                AND user_id = ?
                AND expires_at > UTC_TIMESTAMP()
            LIMIT 1
            `,
            [jti, userId]
        );

        if (!rows.length) {
            return res.status(401).json({ status: 'error', message: 'Session revoked or expired.' });
        }

        // 3) OK
        return res.json({
            status: 'ok',
            user_id: userId,
            exp: decoded.exp,                   // segundos UNIX (del JWT)
            now: Math.floor(Date.now() / 1000), // segundos UNIX
        });
    } catch (err) {
        console.error('check_session error:', err);
        return res.status(500).json({ status: 'error', message: 'Server error.' });
    }
});

module.exports = router;
