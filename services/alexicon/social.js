const express = require('express');

const pool = require('../../utils/db_conn');
const { authRequired } = require('../../utils/auth');
const { asyncRoute } = require('../../utils/route');
const { emitNotification } = require('../../utils/socket');

const router = express.Router();

function validId(id) {
    return Number.isFinite(id) && id > 0;
}

// GET /alexicon/social/mentions?q=alex
router.get('/mentions', authRequired, asyncRoute(async (req, res) => {
    const userId = req.userId;
    const q = String(req.query.q || '').trim();

    if (q.length < 1) {
        return res.json({ status: 'success', users: [] });
    }

    const like = `${q}%`;

    const [users] = await pool.execute(
        `SELECT u.id, u.name, u.surname, u.nickname, u.at_sign, u.profile_pic
         FROM users u
         INNER JOIN follows f
            ON f.followed_id = u.id
         WHERE f.follower_id = ?
           AND (
                u.at_sign LIKE ?
                OR u.nickname LIKE ?
                OR u.name LIKE ?
           )
         LIMIT 8`,
        [userId, like, like, like]
    );

    return res.json({
        status: 'success',
        users
    });
}));

// POST /alexicon/social/:id/follow
router.post('/:id/follow', authRequired, asyncRoute(async (req, res) => {
    const followedId = Number(req.params.id);
    const followerId = req.userId;

    if (!validId(followedId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    if (followerId === followedId) {
        return res.status(400).json({
            status: 'error',
            message: 'No puedes seguirte a ti misma.'
        });
    }

    const [users] = await pool.execute(
        `SELECT id FROM users WHERE id = ? LIMIT 1`,
        [followedId]
    );

    if (!users.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Usuario no encontrado.'
        });
    }

    const [blocked] = await pool.execute(
        `SELECT 1
         FROM blocks
         WHERE (blocker_id = ? AND blocked_id = ?)
            OR (blocker_id = ? AND blocked_id = ?)
         LIMIT 1`,
        [followerId, followedId, followedId, followerId]
    );

    if (blocked.length) {
        return res.status(403).json({
            status: 'error',
            message: 'No puedes seguir a este usuario.'
        });
    }

    await pool.execute(
        `INSERT IGNORE INTO follows (follower_id, followed_id)
         VALUES (?, ?)`,
        [followerId, followedId]
    );

    // notifications:
    if (Number(followedId) !== Number(req.userId)) {
        try {
            const [users] = await pool.execute(
                `SELECT id, name, surname, nickname, at_sign, profile_pic
                FROM users
                WHERE id = ?
                LIMIT 1`,
                [req.userId]
            );

            await emitNotification(followedId, 'follow', 'alexicon', {
                message: 'You have a new follower',
                follower_id: req.userId,
                ...users[0],
                timestamp: new Date().toISOString()
            });
        } catch (notifyErr) {
            console.error('emitNotification error (follow):', notifyErr);
        }
    }

    return res.json({
        status: 'success',
        message: 'Usuario seguido correctamente.'
    });
}));

// DELETE /alexicon/social/:id/follow
router.delete('/:id/follow', authRequired, asyncRoute(async (req, res) => {
    const followedId = Number(req.params.id);
    const followerId = req.userId;

    if (!validId(followedId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    await pool.execute(
        `DELETE FROM follows
         WHERE follower_id = ? AND followed_id = ?`,
        [followerId, followedId]
    );

    return res.json({
        status: 'success',
        message: 'Usuario dejado de seguir.'
    });
}));

// POST /alexicon/social/:id/block
router.post('/:id/block', authRequired, asyncRoute(async (req, res) => {
    const blockedId = Number(req.params.id);
    const blockerId = req.userId;

    if (!validId(blockedId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    if (blockerId === blockedId) {
        return res.status(400).json({
            status: 'error',
            message: 'No puedes bloquearte a ti misma.'
        });
    }

    const [users] = await pool.execute(
        `SELECT id FROM users WHERE id = ? LIMIT 1`,
        [blockedId]
    );

    if (!users.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Usuario no encontrado.'
        });
    }

    await pool.execute(
        `INSERT IGNORE INTO blocks (blocker_id, blocked_id)
         VALUES (?, ?)`,
        [blockerId, blockedId]
    );

    await pool.execute(
        `DELETE FROM follows
         WHERE (follower_id = ? AND followed_id = ?)
            OR (follower_id = ? AND followed_id = ?)`,
        [blockerId, blockedId, blockedId, blockerId]
    );

    return res.json({
        status: 'success',
        message: 'Usuario bloqueado correctamente.'
    });
}));

// DELETE /alexicon/social/:id/block
router.delete('/:id/block', authRequired, asyncRoute(async (req, res) => {
    const blockedId = Number(req.params.id);
    const blockerId = req.userId;

    if (!validId(blockedId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    await pool.execute(
        `DELETE FROM blocks
         WHERE blocker_id = ? AND blocked_id = ?`,
        [blockerId, blockedId]
    );

    return res.json({
        status: 'success',
        message: 'Usuario desbloqueado correctamente.'
    });
}));

// GET /alexicon/social/blocked
router.get('/blocked', authRequired, asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(
        `SELECT
            u.id,
            u.name,
            u.surname,
            u.nickname,
            u.at_sign,
            u.profile_pic,
            b.created_at
         FROM blocks b
         INNER JOIN users u ON u.id = b.blocked_id
         WHERE b.blocker_id = ?
         ORDER BY b.created_at DESC`,
        [req.userId]
    )

    return res.json({
        status: 'success',
        data: {
            users: rows
        }
    })
}))

module.exports = router;