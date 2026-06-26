const express = require('express')

const pool = require('../../utils/db_conn')
const { authRequired } = require('../../utils/auth')
const { asyncRoute } = require('../../utils/route')

const router = express.Router()

const DEFAULT_SERVICES = ['alexicon', 'yipnet', 'alyx']

router.get('/me', authRequired, asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(`
        SELECT
            service,
            tier,
            active,
            subscription_date,
            expires_at,
            metadata
        FROM user_services
        WHERE user_id = ?
    `, [req.userId])

    const services = {}

    for (const service of DEFAULT_SERVICES) {
        services[service] = {
            service,
            tier: 0,
            active: 1,
            subscription_date: null,
            expires_at: null,
            metadata: {}
        }
    }

    for (const row of rows) {
        let metadata = row.metadata || {}

        if (typeof metadata === 'string') {
            try {
                metadata = JSON.parse(metadata)
            } catch {
                metadata = {}
            }
        }

        services[row.service] = {
            ...row,
            active: !!row.active,
            metadata
        }
    }

    return res.json({
        status: 'success',
        data: services
    })
}))

module.exports = router