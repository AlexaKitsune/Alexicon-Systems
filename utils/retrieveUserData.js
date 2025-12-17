const pool = require('./dbConn');
require('dotenv').config();

const FIELDS = ["id", "name", "surname", "nickname", "at_sign", "birthday", "gender", "description", "current_profile_pic", "current_cover_pic", "list_positive", "list_negative", "list_positive_external", "list_negative_external", "services", "api_code", "verified", "verify_key_refresh"];

async function retrieveUserData(userId) {
    try {
        const uid = Number(userId);
        if (!Number.isFinite(uid)) return null;

        const [rows] = await pool.execute(`SELECT ${FIELDS.join(', ')} FROM users WHERE id = ?`, [uid]);
        if (!rows || rows.length === 0) return null;

        const row = rows[0];

        const userData = {};
        for (const F of FIELDS) userData[F] = F === "api_code" ? (row[F] ? 1 : 0) : row[F];

        return userData;
    } catch (err) {
        console.error("Database error:", err);
        return "Database error.";
    }
}

module.exports = { retrieveUserData };