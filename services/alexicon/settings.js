const express = require('express')

const pool = require('../../utils/db_conn')
const { authRequired } = require('../../utils/auth')
const { asyncRoute } = require('../../utils/route')

const router = express.Router()

const allowedLanguages = ['en', 'es', 'ja']

function normalizeBool(value) {
    return value ? 1 : 0
}

async function ensureSettings(userId) {
    await pool.execute(
        `INSERT IGNORE INTO settings (user_id)
         VALUES (?)`,
        [userId]
    )
}

router.get('/me', authRequired, asyncRoute(async (req, res) => {
    await ensureSettings(req.userId)

    const [rows] = await pool.execute(
        `SELECT *
         FROM settings
         WHERE user_id = ?
         LIMIT 1`,
        [req.userId]
    )

    return res.json({
        status: 'success',
        data: rows[0]
    })
}))

router.patch('/me', authRequired, asyncRoute(async (req, res) => {
    await ensureSettings(req.userId)

    const allowedFields = [
        'show_nsfw',
        'hide_deadname',
        'replace_deadname',
        'deadname',
        'chosen_name',
        'language',
        'extra'
    ]

    const updates = []
    const values = []

    for (const field of allowedFields) {
        if (req.body[field] === undefined) continue

        if (field === 'language') {
            if (!allowedLanguages.includes(req.body.language)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Idioma inválido.'
                })
            }

            updates.push('language = ?')
            values.push(req.body.language)
            continue
        }

        if (['show_nsfw', 'hide_deadname', 'replace_deadname'].includes(field)) {
            updates.push(`${field} = ?`)
            values.push(normalizeBool(req.body[field]))
            continue
        }

        if (field === 'extra') {
            updates.push('extra = ?')
            values.push(JSON.stringify(req.body.extra || {}))
            continue
        }

        updates.push(`${field} = ?`)
        values.push(req.body[field] || null)
    }

    if (!updates.length) {
        return res.status(400).json({
            status: 'error',
            message: 'No hay campos para actualizar.'
        })
    }

    values.push(req.userId)

    await pool.execute(
        `UPDATE settings
         SET ${updates.join(', ')}
         WHERE user_id = ?
         LIMIT 1`,
        values
    )

    const [rows] = await pool.execute(
        `SELECT *
         FROM settings
         WHERE user_id = ?
         LIMIT 1`,
        [req.userId]
    )

    return res.json({
        status: 'success',
        message: 'Configuración actualizada.',
        data: rows[0]
    })
}))

module.exports = router