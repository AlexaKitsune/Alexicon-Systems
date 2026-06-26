const express = require('express')

const pool = require('../../utils/db_conn')
const { authOptional, authRequired } = require('../../utils/auth')
const { asyncRoute } = require('../../utils/route')

const router = express.Router()

function validId(id) {
    return Number.isFinite(id) && id > 0
}

// GET /alexicon/badges/user/:userId
router.get('/user/:userId', authOptional, asyncRoute(async (req, res) => {
    const userId = Number(req.params.userId)

    if (!validId(userId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        })
    }

    const [rows] = await pool.execute(
        `SELECT
            b.id,
            b.code,
            b.name,
            b.description,
            b.image,
            b.service,
            b.rarity,
            ub.awarded_at,
            ub.reason
         FROM user_badges ub
         INNER JOIN badges b ON b.id = ub.badge_id
         WHERE ub.user_id = ?
         ORDER BY ub.awarded_at DESC`,
        [userId]
    )

    return res.json({
        status: 'success',
        data: {
            badges: rows
        }
    })
}))

// POST /alexicon/badges/user/:userId/:badgeCode
// Por ahora manual/admin/dev. Luego proteger con roles.
router.post('/user/:userId/:badgeCode', authRequired, asyncRoute(async (req, res) => {
    const userId = Number(req.params.userId)
    const badgeCode = String(req.params.badgeCode || '').trim()
    const { reason = null } = req.body

    if (!validId(userId) || !badgeCode) {
        return res.status(400).json({
            status: 'error',
            message: 'Datos inválidos.'
        })
    }

    const [badges] = await pool.execute(
        `SELECT id
         FROM badges
         WHERE code = ?
         LIMIT 1`,
        [badgeCode]
    )

    if (!badges.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Medalla no encontrada.'
        })
    }

    await pool.execute(
        `INSERT IGNORE INTO user_badges
         (user_id, badge_id, awarded_by, reason)
         VALUES (?, ?, ?, ?)`,
        [userId, badges[0].id, req.userId, reason]
    )

    return res.json({
        status: 'success',
        message: 'Medalla asignada correctamente.'
    })
}))

module.exports = router