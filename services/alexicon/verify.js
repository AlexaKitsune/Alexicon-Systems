// services/alexicon/verify.js
const express = require('express');
const pool = require('../../utils/dbConn');
require('dotenv').config();

const router = express.Router();

// TTL (minutos). Ej: 60 = 1h, 1440 = 24h
const VERIFY_KEY_TTL_MINUTES = Number(process.env.VERIFY_KEY_TTL_MINUTES || 60);

/**
 * GET /alexicon/verify?id=123&verify_key=abcdef
 */
router.get('/verify', async (req, res) => {
    const { id, verify_key } = req.query;

    const uid = Number(id);
    if (!Number.isFinite(uid) || !verify_key || typeof verify_key !== 'string') {
        return res.status(400).json({ status: 'error', message: 'Parámetros inválidos.' });
    }

    try {
        // 1) Traer datos necesarios para validar
        const [rows] = await pool.execute(
            `SELECT verified, verify_key, verify_key_refresh
            FROM users
            WHERE id = ?
            LIMIT 1`,
            [uid]
        );

        if (!rows.length) {
            return res.status(400).json({ status: 'error', message: 'Invalid or already verified link.' });
        }

        const user = rows[0];

        // 2) Si ya está verificado, corta
        if (Number(user.verified) === 1) {
            return res.status(400).json({ status: 'error', message: 'Invalid or already verified link.' });
        }

        // 3) Validar que el verify_key coincida
        if (!user.verify_key || user.verify_key !== verify_key) {
            return res.status(400).json({ status: 'error', message: 'Invalid or already verified link.' });
        }

        // 4) Validar expiración por TTL usando verify_key_refresh
        //    (verifica que no hayan pasado más de VERIFY_KEY_TTL_MINUTES desde la emisión)
        const [ttlRows] = await pool.execute(
            `SELECT (TIMESTAMPDIFF(MINUTE, verify_key_refresh, NOW()) <= ?) AS not_expired
            FROM users
            WHERE id = ?
            LIMIT 1`,
            [VERIFY_KEY_TTL_MINUTES, uid]
        );

        const notExpired = ttlRows?.[0]?.not_expired === 1;
        if (!notExpired) {
            return res.status(400).json({
                status: 'error',
                message: 'Verification link expired. Request a new one.'
            });
        }

        // 5) Marcar como verificado y limpiar verify_key para evitar reuso
        const [result] = await pool.execute(
            `UPDATE users
            SET verified = 1, verify_key = NULL
            WHERE id = ? AND verify_key = ?`,
            [uid, verify_key]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ status: 'error', message: 'Invalid or already verified link.' });
        }

        return res.json({ status: 'ok', message: 'Email verified successfully.' });
    } catch (err) {
        console.error('[verify] Error:', err);
        return res.status(500).json({ status: 'error', message: 'Error del servidor.' });
    }
});

module.exports = router;