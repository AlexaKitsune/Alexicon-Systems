const express = require('express')

const pool = require('../../utils/db_conn')
const { authRequired } = require('../../utils/auth')
const { asyncRoute } = require('../../utils/route')

const router = express.Router()

function formatBytes(bytes) {
    const value = Number(bytes || 0)

    if (value >= 1024 * 1024 * 1024)
        return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`

    if (value >= 1024 * 1024)
        return `${(value / 1024 / 1024).toFixed(2)} MB`

    if (value >= 1024)
        return `${(value / 1024).toFixed(2)} KB`

    return `${value} B`
}

router.get('/me', authRequired, asyncRoute(async (req, res) => {
    const [messageRows] = await pool.execute(`
        SELECT COUNT(m.id) AS count
        FROM alyx_messages m
        INNER JOIN alyx_chats c ON c.id = m.chat_id
        WHERE c.owner_id = ?
          AND m.role = 'user'
          AND m.created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
    `, [req.userId])

    const [chatRows] = await pool.execute(`
        SELECT COUNT(*) AS count
        FROM alyx_chats
        WHERE owner_id = ?
    `, [req.userId])

    const [projectRows] = await pool.execute(`
        SELECT COUNT(*) AS count
        FROM alyx_projects
        WHERE owner_id = ?
    `, [req.userId])

    const [storageRows] = await pool.execute(`
        SELECT COALESCE(SUM(size), 0) AS size
        FROM files
        WHERE rel_path LIKE ?
    `, [`alyx/${req.userId}/%`])

    const messages = Number(messageRows[0]?.count || 0)
    const chats = Number(chatRows[0]?.count || 0)
    const projects = Number(projectRows[0]?.count || 0)
    const storageBytes = Number(storageRows[0]?.size || 0)

    return res.json({
        status: 'success',
        data: {
            messages,
            messageLimit: 1000,
            chats,
            projects,
            storageBytes,
            storage: formatBytes(storageBytes),
            storageLimit: '1 GB',
            storagePercent: Math.min((storageBytes / (1024 * 1024 * 1024)) * 100, 100)
        }
    })
}))

module.exports = router