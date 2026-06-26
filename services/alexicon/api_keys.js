const express = require('express')
const crypto = require('crypto')

const pool = require('../../utils/db_conn')
const { authRequired } = require('../../utils/auth')
const { asyncRoute } = require('../../utils/route')

const router = express.Router()

function hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex')
}

function generateApiKey() {
    return `akx_${crypto.randomBytes(32).toString('hex')}`
}

router.get('/', authRequired, asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(`
        SELECT
            id,
            name,
            key_prefix,
            services,
            scopes,
            active,
            last_used_at,
            created_at,
            revoked_at
        FROM api_keys
        WHERE user_id = ?
        ORDER BY created_at DESC
    `, [req.userId])

    return res.json({
        status: 'success',
        data: rows
    })
}))

router.post('/', authRequired, asyncRoute(async (req, res) => {
    const name = String(req.body.name || 'API Key').trim()
    const services = Array.isArray(req.body.services) ? req.body.services : ['alyx']
    const scopes = Array.isArray(req.body.scopes) ? req.body.scopes : []

    const apiKey = generateApiKey()
    const keyPrefix = apiKey.slice(0, 12)
    const keyHash = hashKey(apiKey)

    const [result] = await pool.execute(`
        INSERT INTO api_keys
            (user_id, name, key_prefix, key_hash, services, scopes)
        VALUES
            (?, ?, ?, ?, ?, ?)
    `, [
        req.userId,
        name,
        keyPrefix,
        keyHash,
        JSON.stringify(services),
        JSON.stringify(scopes)
    ])

    return res.status(201).json({
        status: 'success',
        data: {
            id: result.insertId,
            name,
            key: apiKey,
            key_prefix: keyPrefix,
            services,
            scopes,
            active: 1
        }
    })
}))

router.delete('/:id', authRequired, asyncRoute(async (req, res) => {
    const keyId = Number(req.params.id)

    if (!Number.isFinite(keyId) || keyId <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'API key inválida.'
        })
    }

    await pool.execute(`
        UPDATE api_keys
        SET active = 0, revoked_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
        LIMIT 1
    `, [keyId, req.userId])

    return res.json({
        status: 'success',
        message: 'API key revocada correctamente.'
    })
}))

module.exports = router