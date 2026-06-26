const express = require('express');

const pool = require('../../utils/db_conn');
const { authRequired, authOptional } = require('../../utils/auth');
const { asyncRoute } = require('../../utils/route');
const { emitNotification } = require('../../utils/socket');

const router = express.Router();

const allowedTargetTypes = ['post', 'comment', 'message'];
const allowedVoteTypes = ['heart', 'up', 'down'];

function validId(id) {
    return Number.isFinite(id) && id > 0;
}

async function targetExists(targetType, targetId) {
    const tables = {
        post: 'posts',
        comment: 'comments',
        message: 'messages'
    };

    const [rows] = await pool.execute(
        `SELECT id FROM ${tables[targetType]} WHERE id = ? LIMIT 1`,
        [targetId]
    );

    return !!rows.length;
}

async function registerVoteStatistic(req, targetType, targetId, eventType, voteType = null) {
    if (!['post', 'comment', 'profile'].includes(targetType)) return;

    await pool.execute(
        `INSERT INTO yipnet_statistics
         (target_type, target_id, event_type, actor_id, vote_type, user_agent, origin)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            targetType,
            targetId,
            eventType,
            req.userId || null,
            voteType,
            req.headers['user-agent'] || null,
            req.headers.origin || null
        ]
    );
}

async function getTargetOwner(targetType, targetId) {
    const queries = {
        post: `SELECT owner_id FROM posts WHERE id = ? LIMIT 1`,
        comment: `SELECT owner_id FROM comments WHERE id = ? LIMIT 1`,
        message: `SELECT sender_id AS owner_id FROM messages WHERE id = ? LIMIT 1`
    };

    const [rows] = await pool.execute(queries[targetType], [targetId]);
    return rows[0]?.owner_id || null;
}

// PUT /yipnet/votes/:targetType/:targetId
router.put('/:targetType/:targetId', authRequired, asyncRoute(async (req, res) => {
    const { targetType } = req.params
    const targetId = Number(req.params.targetId)
    const { vote_type } = req.body

    if (!allowedTargetTypes.includes(targetType)) {
        return res.status(400).json({
            status: 'error',
            message: 'Tipo de objetivo inválido.'
        })
    }

    if (!validId(targetId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        })
    }

    if (!allowedVoteTypes.includes(vote_type)) {
        return res.status(400).json({
            status: 'error',
            message: 'Tipo de voto inválido.'
        })
    }

    const exists = await targetExists(targetType, targetId)

    if (!exists) {
        return res.status(404).json({
            status: 'error',
            message: 'Contenido no encontrado.'
        })
    }

    await pool.execute(
        `INSERT INTO votes (user_id, target_type, target_id, vote_type)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            vote_type = VALUES(vote_type),
            vote_date = CURRENT_TIMESTAMP`,
        [req.userId, targetType, targetId, vote_type]
    )

    const ownerId = await getTargetOwner(targetType, targetId)

    let postId = null
    let commentId = null

    if (targetType === 'post') {
        postId = targetId
    }

    if (targetType === 'comment') {
        commentId = targetId

        const [commentRows] = await pool.execute(
            `SELECT post_id
             FROM comments
             WHERE id = ?
             LIMIT 1`,
            [targetId]
        )

        postId = commentRows[0]?.post_id || null
    }

    // notifications:
    if (ownerId && Number(ownerId) !== Number(req.userId)) {
        try {
            const [users] = await pool.execute(
                `SELECT id, name, surname, nickname, at_sign, profile_pic
                 FROM users
                 WHERE id = ?
                 LIMIT 1`,
                [req.userId]
            )

            await emitNotification(ownerId, 'vote', 'yipnet', {
                message: 'You have a new reaction',
                user: users[0] || null,
                entityType: targetType,
                targetId,
                postId,
                commentId,
                voteType: vote_type,
                timestamp: new Date().toISOString()
            })
        } catch (notifyErr) {
            console.error('emitNotification error (vote):', notifyErr)
        }
    }

    await registerVoteStatistic(req, targetType, targetId, 'vote', vote_type)

    return res.json({
        status: 'success',
        message: 'Voto registrado correctamente.'
    })
}))

// DELETE /yipnet/votes/:targetType/:targetId
router.delete('/:targetType/:targetId', authRequired, asyncRoute(async (req, res) => {
    const { targetType } = req.params;
    const targetId = Number(req.params.targetId);

    if (!allowedTargetTypes.includes(targetType)) {
        return res.status(400).json({
            status: 'error',
            message: 'Tipo de objetivo inválido.'
        });
    }

    if (!validId(targetId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const [existingVotes] = await pool.execute(
        `SELECT vote_type
        FROM votes
        WHERE user_id = ?
        AND target_type = ?
        AND target_id = ?
        LIMIT 1`,
        [req.userId, targetType, targetId]
    );

    const previousVoteType = existingVotes[0]?.vote_type || null;

    await pool.execute(
        `DELETE FROM votes
         WHERE user_id = ?
           AND target_type = ?
           AND target_id = ?
         LIMIT 1`,
        [req.userId, targetType, targetId]
    );

    if (previousVoteType) {
        await registerVoteStatistic(req, targetType, targetId, 'unvote', previousVoteType);
    }

    return res.json({
        status: 'success',
        message: 'Voto eliminado correctamente.'
    });
}));

// GET /yipnet/votes/:targetType/:targetId
router.get('/:targetType/:targetId', authOptional, asyncRoute(async (req, res) => {
    const { targetType } = req.params;
    const targetId = Number(req.params.targetId);

    if (!allowedTargetTypes.includes(targetType)) {
        return res.status(400).json({
            status: 'error',
            message: 'Tipo de objetivo inválido.'
        });
    }

    if (!validId(targetId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const exists = await targetExists(targetType, targetId);

    if (!exists) {
        return res.status(404).json({
            status: 'error',
            message: 'Contenido no encontrado.'
        });
    }

    const [voteRows] = await pool.execute(
        `SELECT vote_type, COUNT(*) AS count
         FROM votes
         WHERE target_type = ?
           AND target_id = ?
         GROUP BY vote_type`,
        [targetType, targetId]
    );

    const counts = {
        heart: 0,
        up: 0,
        down: 0
    };

    for (const row of voteRows) {
        counts[row.vote_type] = row.count;
    }

    let my_vote = null;

    if (req.userId) {
        const [myRows] = await pool.execute(
            `SELECT vote_type
             FROM votes
             WHERE user_id = ?
               AND target_type = ?
               AND target_id = ?
             LIMIT 1`,
            [req.userId, targetType, targetId]
        );

        my_vote = myRows[0]?.vote_type || null;
    }

    return res.json({
        status: 'success',
        data: {
            target_type: targetType,
            target_id: targetId,
            counts,
            my_vote
        }
    });
}));

module.exports = router;