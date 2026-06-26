const express = require('express');

const pool = require('../../utils/db_conn');
const { authRequired } = require('../../utils/auth');
const { asyncRoute } = require('../../utils/route');

const {
    normalizeServices,
    normalizeCreditPacks,
    calculateSubscriptionTotal,
    createSubscriptionOrder,
    syncServices,
    grantCredits
} = require('../../utils/subscriptions');

const router = express.Router();

// GET /alexicon/subscriptions/me
router.get('/me', authRequired, asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(
        `SELECT service, tier, active, subscription_date, expires_at, metadata
         FROM user_services
         WHERE user_id = ?
         ORDER BY service`,
        [req.userId]
    );

    const map = {};

    rows.forEach(row => {
        map[row.service] = {
            tier: Number(row.tier || 0),
            active: !!row.active,
            subscription_date: row.subscription_date,
            expires_at: row.expires_at,
            metadata: row.metadata
        };
    });

    return res.json({
        status: 'success',
        data: {
            services: rows,
            map
        }
    });
}));

// POST /alexicon/subscriptions/preview
router.post('/preview', authRequired, asyncRoute(async (req, res) => {
    const services = normalizeServices(req.body.services);
    const creditPacks = normalizeCreditPacks(req.body.credit_packs);

    const preview = calculateSubscriptionTotal(services, creditPacks);

    return res.json({
        status: 'success',
        data: preview
    });
}));

// POST /alexicon/subscriptions/checkout-test
router.post('/checkout-test', authRequired, asyncRoute(async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const services = normalizeServices(req.body.services);
        const creditPacks = normalizeCreditPacks(req.body.credit_packs);

        const preview = calculateSubscriptionTotal(services, creditPacks);

        const orderId = await createSubscriptionOrder(
            connection,
            req.userId,
            preview,
            'test'
        );

        await syncServices(
            connection,
            req.userId,
            preview.services
        );

        await grantCredits(
            connection,
            req.userId,
            preview.credit_packs,
            'Test checkout'
        );

        await connection.commit();

        return res.json({
            status: 'success',
            message: 'Checkout test completed.',
            data: {
                order_id: orderId,
                ...preview
            }
        });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}));

module.exports = router;