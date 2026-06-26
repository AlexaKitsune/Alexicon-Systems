const jwt = require('jsonwebtoken');
const pool = require('./db_conn');
require('dotenv').config();

async function getIdByToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY, {
            algorithms: ['HS256']
        });

        const userId = Number(decoded.sub);
        const jti = decoded.jti;

        if (!Number.isFinite(userId) || !jti) {
            return null;
        }

        const [rows] = await pool.execute(
            `SELECT 1
             FROM active_tokens
             WHERE jti = ?
               AND user_id = ?
               AND expires_at > NOW()
             LIMIT 1`,
            [jti, userId]
        );

        return rows.length ? userId : null;
    } catch {
        return null;
    }
}

module.exports = getIdByToken;