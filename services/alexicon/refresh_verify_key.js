const express = require('express');
const crypto = require('crypto');
const pool = require('../../utils/dbConn');
require('dotenv').config();

const router = express.Router();

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateRandomKey(bytes = 32) {
  // 32 bytes => 64 hex chars (muy bien)
  return crypto.randomBytes(bytes).toString('hex');
}

// TTL (ej. 24h). Puede colocarse en .env opcionalmente.
// const VERIFY_KEY_TTL_MINUTES = Number(process.env.VERIFY_KEY_TTL_MINUTES || (24 * 60));

router.post('/refresh_verify_key', async (req, res) => {
    const { email } = req.body || {};

    // Respuesta genérica para evitar enumeración de usuarios
    const ok = () => res.json({ response: "If the account exists, a new verification code was generated." });

    if (!email || !validateEmail(email)) return ok();

    try {
        // 1) Obtener usuario por email
        const [rows] = await pool.execute(
            `SELECT id, verified, verify_key_refresh
            FROM users
            WHERE email = ?
            LIMIT 1`,
            [email]
        );

        if (!rows.length) return ok(); // no revelar si existe o no

        const user = rows[0];

        // 2) Si ya está verificado, no tiene sentido refrescar
        if (Number(user.verified) === 1) {
        return res.json({ response: "Account already verified." });
        }

        // 3) (Opcional) Rate-limit “suave” por tiempo:
        //    Por ejemplo: no permitir refrescar más de una vez cada 2 minutos
        const [cooldownRows] = await pool.execute(
            `SELECT (TIMESTAMPDIFF(SECOND, verify_key_refresh, NOW()) < 120) AS in_cooldown
            FROM users WHERE id = ?`,
            [user.id]
        );
        const inCooldown = cooldownRows?.[0]?.in_cooldown === 1;
        if (inCooldown) {
            // También puedes devolver ok() para no dar pistas, pero esto es útil UX:
            return res.json({ response: "Please wait a bit before requesting a new code." });
        }

        // 4) Generar nueva key y refrescar timestamp
        const newKey = generateRandomKey(32);

        await pool.execute(
            `UPDATE users
            SET verify_key = ?, verify_key_refresh = NOW()
            WHERE id = ?`,
            [newKey, user.id]
        );

        // 5) Aquí normalmente enviarías correo:
        // await sendVerificationEmail(email, newKey);

        return ok();
    } catch (err) {
        console.error("Database error:", err);
        // Igual: respuesta genérica
        return res.status(500).json({ response: "Database error." });
    }
});

module.exports = router;
