const express = require('express');

const pool = require('../../utils/db_conn');
const { authRequired } = require('../../utils/auth');
const { asyncRoute } = require('../../utils/route');

const {
    normalizeCreditPacks,
    calculateSubscriptionTotal,
    createSubscriptionOrder,
    grantCredits
} = require('../../utils/subscriptions');

const router = express.Router();

// GET /alexicon/credits/me
router.get('/me', authRequired, asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(
        `SELECT service, balance, updated_at
         FROM credits
         WHERE user_id = ?
         ORDER BY service`,
        [req.userId]
    );

    return res.json({
        status: 'success',
        data: {
            credits: rows
        }
    });
}));

// GET /alexicon/credits/transactions
router.get('/transactions', authRequired, asyncRoute(async (req, res) => {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const [rows] = await pool.execute(
        `SELECT
            id,
            service,
            type,
            amount,
            balance_after,
            description,
            metadata,
            created_at
         FROM credit_transactions
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [req.userId, limit, offset]
    );

    return res.json({
        status: 'success',
        data: {
            transactions: rows
        }
    });
}));

// POST /alexicon/credits/checkout-test
router.post('/checkout-test', authRequired, asyncRoute(async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const creditPacks = normalizeCreditPacks(req.body.credit_packs);

        const preview = calculateSubscriptionTotal([], creditPacks);

        const orderId = await createSubscriptionOrder(
            connection,
            req.userId,
            preview,
            'test'
        );

        await grantCredits(
            connection,
            req.userId,
            preview.credit_packs,
            'Test credit checkout'
        );

        await connection.commit();

        return res.json({
            status: 'success',
            message: 'Credits added.',
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