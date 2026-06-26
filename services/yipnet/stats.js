const express = require('express')
const crypto = require('crypto')

const pool = require('../../utils/db_conn')
const { authRequired, authOptional } = require('../../utils/auth')
const { asyncRoute } = require('../../utils/route')

const router = express.Router()

const allowedTargetTypes = ['post', 'comment', 'profile']

function validId(id) {
    return Number.isFinite(id) && id > 0
}

function hashIp(req) {
    const rawIp =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        req.ip ||
        ''

    return crypto
        .createHash('sha256')
        .update(`${rawIp}:${process.env.JWT_SECRET_KEY || 'alexicon'}`)
        .digest('hex')
}

async function getOwnerId(targetType, targetId) {
    if (targetType === 'profile') {
        const [rows] = await pool.execute(
            `SELECT id FROM users WHERE id = ? LIMIT 1`,
            [targetId]
        )

        return rows[0]?.id || null
    }

    if (targetType === 'post') {
        const [rows] = await pool.execute(
            `SELECT owner_id FROM posts WHERE id = ? LIMIT 1`,
            [targetId]
        )

        return rows[0]?.owner_id || null
    }

    if (targetType === 'comment') {
        const [rows] = await pool.execute(
            `SELECT owner_id FROM comments WHERE id = ? LIMIT 1`,
            [targetId]
        )

        return rows[0]?.owner_id || null
    }

    return null
}

async function assertOwner(req, res, targetType, targetId) {
    const ownerId = await getOwnerId(targetType, targetId)

    if (!ownerId) {
        res.status(404).json({
            status: 'error',
            message: 'Contenido no encontrado.'
        })

        return false
    }

    if (Number(ownerId) !== Number(req.userId)) {
        res.status(403).json({
            status: 'error',
            message: 'No puedes ver estas estadísticas.'
        })

        return false
    }

    return true
}

// POST /yipnet/stats/view/:targetType/:targetId
router.post('/view/:targetType/:targetId', authOptional, asyncRoute(async (req, res) => {
    const { targetType } = req.params
    const targetId = Number(req.params.targetId)

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

    const ownerId = await getOwnerId(targetType, targetId)

    if (!ownerId) {
        return res.status(404).json({
            status: 'error',
            message: 'Contenido no encontrado.'
        })
    }

    const ipHash = hashIp(req)
    const visitorKey = req.userId ? `user:${req.userId}` : `ip:${ipHash}`

    const [lockResult] = await pool.execute(
        `INSERT IGNORE INTO yipnet_stat_view_locks
         (target_type, target_id, visitor_key, viewed_on)
         VALUES (?, ?, ?, CURRENT_DATE())`,
        [targetType, targetId, visitorKey]
    )

    if (lockResult.affectedRows) {
        await pool.execute(
            `INSERT INTO yipnet_statistics
             (target_type, target_id, event_type, actor_id, ip_hash, user_agent, origin)
             VALUES (?, ?, 'view', ?, ?, ?, ?)`,
            [
                targetType,
                targetId,
                req.userId || null,
                ipHash,
                req.headers['user-agent'] || null,
                req.headers.origin || null
            ]
        )
    }

    return res.json({
        status: 'success',
        message: 'Vista registrada.'
    })
}))

// GET /yipnet/stats/:targetType/:targetId
router.get('/:targetType/:targetId', authRequired, asyncRoute(async (req, res) => {
    const { targetType } = req.params
    const targetId = Number(req.params.targetId)

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

    const canView = await assertOwner(req, res, targetType, targetId)
    if (!canView) return

    const [summaryRows] = await pool.execute(
        `SELECT
            SUM(event_type = 'view') AS views,
            COUNT(DISTINCT CASE WHEN event_type = 'view' THEN actor_id END) AS unique_logged_viewers,
            SUM(event_type = 'vote') AS votes,
            SUM(event_type = 'unvote') AS unvotes,
            SUM(event_type = 'vote' AND vote_type = 'heart') AS hearts,
            SUM(event_type = 'vote' AND vote_type = 'up') AS ups,
            SUM(event_type = 'vote' AND vote_type = 'down') AS downs
         FROM yipnet_statistics
         WHERE target_type = ?
           AND target_id = ?`,
        [targetType, targetId]
    )

    let commentsCount = 0

    if (targetType === 'post') {
        const [commentRows] = await pool.execute(
            `SELECT COUNT(*) AS total
            FROM comments
            WHERE post_id = ?`,
            [targetId]
        )
        commentsCount = Number(commentRows[0]?.total || 0)
    }

    const [voterRows] = await pool.execute(
        `SELECT
            v.vote_type,
            u.id,
            u.name,
            u.surname,
            u.nickname,
            u.at_sign,
            u.profile_pic,
            v.vote_date
        FROM votes v
        INNER JOIN users u ON u.id = v.user_id
        WHERE v.target_type = ?
        AND v.target_id = ?
        ORDER BY v.vote_date DESC`,
        [targetType, targetId]
    )

    const voters = {
        heart: [],
        up: [],
        down: []
    }

    for (const row of voterRows) {
        if (!voters[row.vote_type]) continue

        voters[row.vote_type].push({
            id: row.id,
            name: row.name,
            surname: row.surname,
            nickname: row.nickname,
            at_sign: row.at_sign,
            profile_pic: row.profile_pic,
            vote_date: row.vote_date
        })
    }

    const [dailyViews] = await pool.execute(
        `SELECT DATE(created_at) AS date, COUNT(*) AS count
         FROM yipnet_statistics
         WHERE target_type = ?
           AND target_id = ?
           AND event_type = 'view'
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [targetType, targetId]
    )

    const [dailyVotesRaw] = await pool.execute(
        `SELECT
            DATE(created_at) AS date,
            vote_type,
            COUNT(*) AS count
        FROM yipnet_statistics
        WHERE target_type = ?
        AND target_id = ?
        AND event_type = 'vote'
        AND vote_type IS NOT NULL
        GROUP BY DATE(created_at), vote_type
        ORDER BY date ASC`,
        [targetType, targetId]
    )

    const [recentEvents] = await pool.execute(
        `SELECT event_type, vote_type, actor_id, created_at
         FROM yipnet_statistics
         WHERE target_type = ?
           AND target_id = ?
         ORDER BY created_at DESC
         LIMIT 50`,
        [targetType, targetId]
    )

    const dailyVotesMap = new Map()

    for (const row of dailyVotesRaw) {
        const date = row.date

        if (!dailyVotesMap.has(date)) {
            dailyVotesMap.set(date, {
                date,
                heart: 0,
                up: 0,
                down: 0
            })
        }

        dailyVotesMap.get(date)[row.vote_type] = Number(row.count)
    }

    const dailyVotes = Array.from(dailyVotesMap.values())

    const summary = summaryRows[0] || {}

    const totalVotes =
        Number(summary.hearts || 0) +
        Number(summary.ups || 0) +
        Number(summary.downs || 0)

    summary.comments = commentsCount
    summary.vote_comment_ratio = commentsCount > 0
        ? Number((totalVotes / commentsCount).toFixed(2))
        : totalVotes > 0
            ? totalVotes
            : 0

    return res.json({
        status: 'success',
        data: {
            target_type: targetType,
            target_id: targetId,
            summary,
            voters,
            daily_views: dailyViews,
            daily_votes: dailyVotes,
            recent_events: recentEvents
        }
    });
}))

// GET /yipnet/stats/profile/:userId/contributions
router.get('/profile/:userId/contributions', authOptional, asyncRoute(async (req, res) => {
    const userId = Number(req.params.userId)

    if (!validId(userId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        })
    }

    const [rows] = await pool.execute(
        `SELECT date, SUM(total) AS total
         FROM (
            SELECT DATE(post_date) AS date, COUNT(*) AS total
            FROM posts
            WHERE owner_id = ?
            GROUP BY DATE(post_date)

            UNION ALL

            SELECT DATE(comment_date) AS date, COUNT(*) AS total
            FROM comments
            WHERE owner_id = ?
            GROUP BY DATE(comment_date)
         ) activity
         WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY)
         GROUP BY date
         ORDER BY date ASC`,
        [userId, userId]
    )

    return res.json({
        status: 'success',
        data: {
            contributions: rows.map(row => ({
                date: row.date,
                total: Number(row.total || 0)
            }))
        }
    })
}))

module.exports = router