const express = require('express')

const pool = require('../../utils/db_conn')
const { authOptional } = require('../../utils/auth')
const { asyncRoute } = require('../../utils/route')

const router = express.Router()

function parseSearch(q = '') {
    const text = String(q || '').trim()

    if (text.startsWith('regex:')) {
        return {
            mode: 'regex',
            value: text.replace(/^regex:/, '').trim()
        }
    }

    if (text.startsWith('contiene:')) {
        return {
            mode: 'contains',
            value: text.replace(/^contiene:/, '').trim()
        }
    }

    if (text.startsWith('@')) {
        return {
            mode: 'user_at',
            value: text.replace(/^@/, '').trim()
        }
    }

    return {
        mode: 'normal',
        value: text
    }
}

function safeLimit(value) {
    return Math.min(Number(value) || 20, 100)
}

function safeOffset(value) {
    return Math.max(Number(value) || 0, 0)
}

function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

async function searchUsers({ q, limit, offset }) {
    const parsed = parseSearch(q)

    let where = ''
    let params = []

    if (parsed.value) {
        if (parsed.mode === 'user_at') {
            where = `
                WHERE at_sign LIKE ?
                   OR nickname LIKE ?
            `
            params = [`%${parsed.value}%`, `%${parsed.value}%`]
        } else {
            where = `
                WHERE name LIKE ?
                   OR surname LIKE ?
                   OR nickname LIKE ?
                   OR at_sign LIKE ?
            `
            params = [
                `%${parsed.value}%`,
                `%${parsed.value}%`,
                `%${parsed.value}%`,
                `%${parsed.value}%`
            ]
        }
    }

    params.push(limit, offset)

    const [rows] = await pool.execute(
        `SELECT
            id, name, surname, nickname, at_sign,
            description, profile_pic, followers_count, following_count, verified
         FROM users
         ${where}
         ORDER BY followers_count DESC, id DESC
         LIMIT ? OFFSET ?`,
        params
    )

    return rows
}

function parseJsonArray(value) {
    if (!value) return []

    if (Array.isArray(value)) {
        return value.filter(item => item !== null && item !== undefined)
    }

    try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed)
            ? parsed.filter(item => item !== null && item !== undefined)
            : []
    } catch {
        return []
    }
}

async function getMediaData(mediaIds) {
    const cleanIds = parseJsonArray(mediaIds)
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && id > 0)

    if (!cleanIds.length) return []

    const placeholders = cleanIds.map(() => '?').join(',')

    const [rows] = await pool.execute(
        `SELECT id, rel_path, mime_type, size, visibility
         FROM files
         WHERE id IN (${placeholders})`,
        cleanIds
    )

    const byId = new Map(rows.map(row => [Number(row.id), row]))

    return cleanIds
        .map(id => byId.get(id))
        .filter(Boolean)
        .map(file => ({
            id: file.id,
            filename: file.rel_path.split('/').pop(),
            rel_path: file.rel_path,
            mime_type: file.mime_type,
            type: file.mime_type,
            size: file.size,
            visibility: file.visibility,
            url: `/alexicon/media/${file.id}`
        }))
}

async function getPostViewerData(postId, viewerId) {
    if (!viewerId) {
        return {
            my_vote: null
        }
    }

    const [rows] = await pool.execute(
        `SELECT vote_type
         FROM votes
         WHERE user_id = ?
           AND target_type = 'post'
           AND target_id = ?
         LIMIT 1`,
        [viewerId, postId]
    )

    return {
        my_vote: rows[0]?.vote_type || null
    }
}

async function getPostVotes(postId, viewerId) {
    const [voteRows] = await pool.execute(
        `SELECT vote_type, COUNT(*) AS count
         FROM votes
         WHERE target_type = 'post'
           AND target_id = ?
         GROUP BY vote_type`,
        [postId]
    )

    const votes = {
        heart: 0,
        up: 0,
        down: 0
    }

    for (const row of voteRows) {
        votes[row.vote_type] = Number(row.count)
    }

    const viewer = await getPostViewerData(postId, viewerId)

    return {
        votes,
        viewer
    }
}

async function normalizePost(post, viewerId = null) {
    const mediaIds = parseJsonArray(post.media)
    const sharedByList = parseJsonArray(post.shared_by_list)

    const media = await getMediaData(mediaIds)
    const { votes, viewer } = await getPostVotes(post.id, viewerId)

    return {
        ...post,
        media,
        shared_by_list: sharedByList,
        private_post: !!post.private_post,
        nsfw_post: !!post.nsfw_post,
        ai_generated: !!post.ai_generated,
        votes,
        viewer
    }
}

async function normalizePosts(posts, viewerId = null) {
    return Promise.all(posts.map(post => normalizePost(post, viewerId)))
}

async function searchPosts({
    q,
    from,
    to,
    limit,
    offset,
    ownerId = null,
    includeFiles = false,
    includeUrls = false,
    caseSensitive = false,
    aiGenerated = false,
    nsfw = false
}) {
    const parsed = parseSearch(q)

    const where = ['p.private_post = 0']
    const params = []

    if (ownerId) {
        where.push('p.owner_id = ?')
        params.push(ownerId)
    }

    if (parsed.value) {
        if (parsed.mode === 'regex') {
            where.push(caseSensitive ? 'p.content REGEXP BINARY ?' : 'p.content REGEXP ?')
            params.push(parsed.value)
        } else {
            where.push(caseSensitive ? 'p.content LIKE BINARY ?' : 'p.content LIKE ?')
            params.push(`%${parsed.value}%`)
        }
    }

    if (from && validDate(from)) {
        where.push('DATE(p.post_date) >= ?')
        params.push(from)
    }

    if (to && validDate(to)) {
        where.push('DATE(p.post_date) <= ?')
        params.push(to)
    }

    if (includeFiles) {
        where.push(`p.media IS NOT NULL AND p.media != '[]'`)
    }

    if (includeUrls) {
        where.push(`p.content REGEXP 'https?://|www\\\\.'`)
    }

    if (aiGenerated) {
        where.push('p.ai_generated = 1')
    }

    if (nsfw) {
        where.push('p.nsfw_post = 1')
    }

    params.push(limit, offset)

    const [rows] = await pool.execute(
        `SELECT
            p.id, p.owner_id, p.content, p.media, p.shared_by_list,
            p.sharing_id, p.private_post, p.nsfw_post, p.ai_generated,
            p.comment_count, p.post_date, p.origin,
            u.name, u.surname, u.nickname, u.at_sign, u.profile_pic
         FROM posts p
         INNER JOIN users u ON u.id = p.owner_id
         WHERE ${where.join(' AND ')}
         ORDER BY p.post_date DESC
         LIMIT ? OFFSET ?`,
        params
    )

    return rows
}

// GET /yipnet/search/global?q=&type=all&from=&to=&limit=20&offset=0
router.get('/global', authOptional, asyncRoute(async (req, res) => {
    const {
        q = '',
        type = 'all',
        from,
        to
    } = req.query

    const limit = safeLimit(req.query.limit)
    const offset = safeOffset(req.query.offset)

    const data = {
        users: [],
        posts: []
    }

    data.posts = await searchPosts({
        q,
        from,
        to,
        limit,
        offset,
        includeFiles: req.query.include_files === '1',
        includeUrls: req.query.include_urls === '1',
        caseSensitive: req.query.case_sensitive === '1',
        aiGenerated: req.query.ai_generated === '1',
        nsfw: req.query.nsfw === '1'
    })

    if (type === 'all' || type === 'users') {
        data.users = await searchUsers({ q, limit, offset })
    }

    if (type === 'all' || type === 'posts') {
        const posts = await searchPosts({
            q,
            from,
            to,
            limit,
            offset,
            includeFiles: req.query.include_files === '1',
            includeUrls: req.query.include_urls === '1',
            caseSensitive: req.query.case_sensitive === '1',
            aiGenerated: req.query.ai_generated === '1',
            nsfw: req.query.nsfw === '1'
        })

        data.posts = await normalizePosts(posts, req.userId)
    }

    return res.json({
        status: 'success',
        data
    })
}))

// GET /yipnet/search/profile/:userId?q=&from=&to=&limit=20&offset=0
router.get('/profile/:userId', authOptional, asyncRoute(async (req, res) => {
    const userId = Number(req.params.userId)

    if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        })
    }

    const {
        q = '',
        from,
        to
    } = req.query

    const limit = safeLimit(req.query.limit)
    const offset = safeOffset(req.query.offset)

    const posts = await searchPosts({
        q,
        from,
        to,
        limit,
        offset,
        ownerId: userId,
        includeFiles: req.query.include_files === '1',
        includeUrls: req.query.include_urls === '1',
        caseSensitive: req.query.case_sensitive === '1',
        aiGenerated: req.query.ai_generated === '1',
        nsfw: req.query.nsfw === '1'
    });

    return res.json({
        status: 'success',
        data: {
            posts: await normalizePosts(posts, req.userId)
        }
    });
}))

module.exports = router