const express = require('express');

const pool = require('../../utils/db_conn');
const { authRequired } = require('../../utils/auth');
const { asyncRoute } = require('../../utils/route');

const router = express.Router();

// GET /alexicon/notifications?limit=20&offset=0&seen=0
router.get('/', authRequired, asyncRoute(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const params = [req.userId];
    let seenFilter = '';

    if (req.query.seen === '0' || req.query.seen === '1') {
        seenFilter = 'AND seen = ?';
        params.push(Number(req.query.seen));
    }

    params.push(limit, offset);

    const [rows] = await pool.execute(
        `SELECT id, owner_id, seen, service, content, event, notif_date
         FROM notifications
         WHERE owner_id = ?
         ${seenFilter}
         ORDER BY notif_date DESC
         LIMIT ? OFFSET ?`,
        params
    );

    const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS unread_count
         FROM notifications
         WHERE owner_id = ? AND seen = 0`,
        [req.userId]
    );

    return res.json({
        status: 'success',
        data: {
            notifications: rows,
            unread_count: countRows[0].unread_count,
            pagination: {
                limit,
                offset,
                next_offset: rows.length === limit ? offset + limit : null
            }
        }
    });
}));

// PATCH /alexicon/notifications/read-all
router.patch('/read-all', authRequired, asyncRoute(async (req, res) => {
    const [result] = await pool.execute(
        `UPDATE notifications
         SET seen = 1
         WHERE owner_id = ? AND seen = 0`,
        [req.userId]
    );

    return res.json({
        status: 'success',
        message: 'Notificaciones marcadas como leídas.',
        data: {
            affected: result.affectedRows
        }
    });
}));

// PATCH /alexicon/notifications/:id/read
router.patch('/:id/read', authRequired, asyncRoute(async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const [result] = await pool.execute(
        `UPDATE notifications
         SET seen = 1
         WHERE id = ? AND owner_id = ?
         LIMIT 1`,
        [id, req.userId]
    );

    if (!result.affectedRows) {
        return res.status(404).json({
            status: 'error',
            message: 'Notificación no encontrada.'
        });
    }

    return res.json({
        status: 'success',
        message: 'Notificación marcada como leída.'
    });
}));

module.exports = router;