const express = require('express');

const pool = require('../../utils/db_conn');
const { authRequired, authOptional } = require('../../utils/auth');
const { asyncRoute } = require('../../utils/route');
const { emitNotification } = require('../../utils/socket');
const { extractMentions } = require('../../utils/mentions');

const router = express.Router();

function validId(id) {
    return Number.isFinite(id) && id > 0;
}

function parseJsonArray(value) {
    if (!value) return [];

    // Si ya es un array nativo, lo limpiamos de valores nulos o basura y lo devolvemos
    if (Array.isArray(value)) {
        return value.filter(item => item !== null && item !== undefined);
    }

    try {
        // Si viene como String desde la BD, lo parseamos
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.filter(item => item !== null && item !== undefined);
        }
        return [];
    } catch {
        return [];
    }
}

function postSelectFields() {
    return `
        p.id, p.owner_id, p.content, p.media, p.shared_by_list,
        p.sharing_id, p.private_post, p.nsfw_post, p.ai_generated,
        p.comment_count, p.post_date, p.origin,
        u.name, u.surname, u.nickname, u.at_sign, u.profile_pic
    `;
}

async function getMediaData(mediaIds) {
    if (!mediaIds.length) return []

    const cleanIds = mediaIds
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

async function getPostVotes(postId, viewerId) {
    const [voteRows] = await pool.execute(
        `SELECT vote_type, COUNT(*) AS count
         FROM votes
         WHERE target_type = 'post'
           AND target_id = ?
         GROUP BY vote_type`,
        [postId]
    );

    const votes = {
        heart: 0,
        up: 0,
        down: 0
    };

    for (const row of voteRows) {
        votes[row.vote_type] = Number(row.count);
    }

    const viewer = await getPostViewerData(postId, viewerId);

    return { votes, viewer };
}

async function normalizePostWithMedia(post, viewerId = null, depth = 0) {
    const normalized = normalizePost(post);

    normalized.media = await getMediaData(normalized.media);

    const { votes, viewer } = await getPostVotes(normalized.id, viewerId);

    normalized.votes = votes;
    normalized.viewer = viewer;

    normalized.shared_post = null;

    if (normalized.sharing_id && depth < 1) {
        const [sharedRows] = await pool.execute(
            `SELECT ${postSelectFields()}
             FROM posts p
             INNER JOIN users u ON u.id = p.owner_id
             WHERE p.id = ?
             LIMIT 1`,
            [normalized.sharing_id]
        );

        if (sharedRows.length) {
            const sharedPost = normalizePost(sharedRows[0]);

            if (await canViewPost(sharedPost, viewerId)) {
                normalized.shared_post = await normalizePostWithMedia(
                    sharedRows[0],
                    viewerId,
                    depth + 1
                );
            }
        }
    }

    return normalized;
}

async function normalizePostsWithMedia(posts, viewerId = null) {
    return Promise.all(posts.map(post => normalizePostWithMedia(post, viewerId)));
}

function normalizePost(post) {
    return {
        ...post,
        media: parseJsonArray(post.media),
        shared_by_list: parseJsonArray(post.shared_by_list),
        private_post: !!post.private_post,
        nsfw_post: !!post.nsfw_post,
        ai_generated: !!post.ai_generated
    };
}

async function getPostViewerData(postId, viewerId) {
    if (!viewerId) {
        return {
            my_vote: null,
            blocked_by_me: false,
            blocks_me: false
        };
    }

    const [voteRows] = await pool.execute(
        `SELECT vote_type
         FROM votes
         WHERE user_id = ?
           AND target_type = 'post'
           AND target_id = ?
         LIMIT 1`,
        [viewerId, postId]
    );

    return {
        my_vote: voteRows[0]?.vote_type || null
    };
}

async function canViewPost(post, viewerId) {
    if (!post.private_post) return true;
    if (viewerId && Number(post.owner_id) === Number(viewerId)) return true;

    return false;
}

// POST /yipnet/posts
router.post('/', authRequired, asyncRoute(async (req, res) => {
    const {
        content,
        media,
        sharing_id,
        private_post = 0,
        nsfw_post = 0,
        ai_generated = 0
    } = req.body;

    if (!content || String(content).trim().length < 1) {
        return res.status(400).json({
            status: 'error',
            message: 'El contenido del post es obligatorio.'
        });
    }

    const mediaList = parseJsonArray(media);

    const [result] = await pool.execute(
        `INSERT INTO posts
         (owner_id, content, media, sharing_id, private_post, nsfw_post, ai_generated, origin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            req.userId,
            String(content).trim(),
            JSON.stringify(mediaList),
            sharing_id ? Number(sharing_id) : null,
            private_post ? 1 : 0,
            nsfw_post ? 1 : 0,
            ai_generated ? 1 : 0,
            req.headers.origin || null
        ]
    );

    const postId = result.insertId;

    if (sharing_id) {
        await pool.execute(
            `UPDATE posts
            SET shared_by_list = JSON_ARRAY_APPEND(
                COALESCE(shared_by_list, JSON_ARRAY()),
                '$',
                ?
            )
            WHERE id = ?
            LIMIT 1`,
            [req.userId, Number(sharing_id)]
        );
    }

    const mentions = extractMentions(content)

    if (mentions.length) {
        const placeholders = mentions.map(() => '?').join(',')

        const [mentionedUsers] = await pool.execute(
            `SELECT id, name, surname, nickname, at_sign, profile_pic
            FROM users
            WHERE LOWER(at_sign) IN (${placeholders})`,
            mentions
        )

        const [authorRows] = await pool.execute(
            `SELECT id, name, surname, nickname, at_sign, profile_pic
            FROM users
            WHERE id = ?
            LIMIT 1`,
            [req.userId]
        )

        const author = authorRows[0] || null

        for (const user of mentionedUsers) {
            if (Number(user.id) === Number(req.userId)) continue

            try {
                await emitNotification(user.id, 'mention', 'yipnet', {
                    message: 'You were mentioned in a post',
                    user: author,
                    mentionedUser: user,
                    entityType: 'post',
                    postId,
                    targetId: postId,
                    preview: String(content || '').trim().slice(0, 160),
                    timestamp: new Date().toISOString()
                })
            } catch (notifyErr) {
                console.error('emitNotification error (mention post):', notifyErr)
            }
        }
    }

    return res.status(201).json({
        status: 'success',
        message: 'Post creado correctamente.',
        data: {
            id: postId,
        }
    });
}));

// GET /yipnet/posts/feed?limit=20&offset=0
router.get('/feed', authRequired, asyncRoute(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [rows] = await pool.execute(
        `SELECT ${postSelectFields()}
         FROM posts p
         INNER JOIN users u ON u.id = p.owner_id
         WHERE p.private_post = 0
           AND p.owner_id NOT IN (
                SELECT blocked_id FROM blocks WHERE blocker_id = ?
           )
           AND p.owner_id NOT IN (
                SELECT blocker_id FROM blocks WHERE blocked_id = ?
           )
         ORDER BY p.post_date DESC
         LIMIT ? OFFSET ?`,
        [req.userId, req.userId, limit, offset]
    );

    const posts = await normalizePostsWithMedia(rows, req.userId);
    return res.json({
        status: 'success',
        data: {
            posts,
            pagination: {
                limit,
                offset,
                next_offset: rows.length === limit ? offset + limit : null
            }
        }
    });
}));

// GET /yipnet/posts/user/:id?limit=20&offset=0
router.get('/user/:id', authOptional, asyncRoute(async (req, res) => {
    const userId = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    if (!validId(userId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    let privateFilter = 'AND p.private_post = 0';
    const params = [userId];

    if (req.userId && req.userId === userId) {
        privateFilter = '';
    }

    if (req.userId && req.userId !== userId) {
        const [blocked] = await pool.execute(
            `SELECT 1
             FROM blocks
             WHERE (blocker_id = ? AND blocked_id = ?)
                OR (blocker_id = ? AND blocked_id = ?)
             LIMIT 1`,
            [req.userId, userId, userId, req.userId]
        );

        if (blocked.length) {
            return res.status(403).json({
                status: 'error',
                message: 'No puedes ver los posts de este usuario.'
            });
        }
    }

    params.push(limit, offset);

    const [rows] = await pool.execute(
        `SELECT ${postSelectFields()}
         FROM posts p
         INNER JOIN users u ON u.id = p.owner_id
         WHERE p.owner_id = ?
         ${privateFilter}
         ORDER BY p.post_date DESC
         LIMIT ? OFFSET ?`,
        params
    );

    return res.json({
        status: 'success',
        data: {
            posts: await normalizePostsWithMedia(rows, req.userId),
            pagination: {
                limit,
                offset,
                next_offset: rows.length === limit ? offset + limit : null
            }
        }
    });
}));

// GET /yipnet/posts/:id
router.get('/:id', authOptional, asyncRoute(async (req, res) => {
    const postId = Number(req.params.id);

    if (!validId(postId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const [rows] = await pool.execute(
        `SELECT ${postSelectFields()}
         FROM posts p
         INNER JOIN users u ON u.id = p.owner_id
         WHERE p.id = ?
         LIMIT 1`,
        [postId]
    );

    if (!rows.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Post no encontrado.'
        });
    }

    const post = await normalizePostWithMedia(rows[0], req.userId);

    if (req.userId && req.userId !== post.owner_id) {
        const [blocked] = await pool.execute(
            `SELECT 1
             FROM blocks
             WHERE (blocker_id = ? AND blocked_id = ?)
                OR (blocker_id = ? AND blocked_id = ?)
             LIMIT 1`,
            [req.userId, post.owner_id, post.owner_id, req.userId]
        );

        if (blocked.length) {
            return res.status(403).json({
                status: 'error',
                message: 'No puedes ver este post.'
            });
        }
    }

    const canView = await canViewPost(post, req.userId);

    if (!canView) {
        return res.status(403).json({
            status: 'error',
            message: 'Este post es privado.'
        });
    }

    const viewer = await getPostViewerData(postId, req.userId);

    const [voteRows] = await pool.execute(
        `SELECT vote_type, COUNT(*) AS count
         FROM votes
         WHERE target_type = 'post'
           AND target_id = ?
         GROUP BY vote_type`,
        [postId]
    );

    const votes = {
        heart: 0,
        up: 0,
        down: 0
    };

    for (const row of voteRows) {
        votes[row.vote_type] = row.count;
    }

    return res.json({
        status: 'success',
        data: {
            ...post,
            votes,
            viewer
        }
    });
}));

// PATCH /yipnet/posts/:id
router.patch('/:id', authRequired, asyncRoute(async (req, res) => {
    const postId = Number(req.params.id);
    const {
        content,
        media,
        private_post,
        nsfw_post
    } = req.body;

    if (!validId(postId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const [posts] = await pool.execute(
        `SELECT owner_id
         FROM posts
         WHERE id = ?
         LIMIT 1`,
        [postId]
    );

    if (!posts.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Post no encontrado.'
        });
    }

    if (posts[0].owner_id !== req.userId) {
        return res.status(403).json({
            status: 'error',
            message: 'No puedes editar este post.'
        });
    }

    const updates = [];
    const values = [];

    if (content !== undefined) {
        if (!String(content).trim()) {
            return res.status(400).json({
                status: 'error',
                message: 'El contenido no puede estar vacío.'
            });
        }

        updates.push('content = ?');
        values.push(String(content).trim());
    }

    if (media !== undefined) {
        updates.push('media = ?');
        values.push(JSON.stringify(parseJsonArray(media)));
    }

    if (private_post !== undefined) {
        updates.push('private_post = ?');
        values.push(private_post ? 1 : 0);
    }

    if (nsfw_post !== undefined) {
        updates.push('nsfw_post = ?');
        values.push(nsfw_post ? 1 : 0);
    }

    if (!updates.length) {
        return res.status(400).json({
            status: 'error',
            message: 'No hay campos para actualizar.'
        });
    }

    values.push(postId);

    await pool.execute(
        `UPDATE posts
         SET ${updates.join(', ')}
         WHERE id = ?
         LIMIT 1`,
        values
    );

    return res.json({
        status: 'success',
        message: 'Post actualizado correctamente.'
    });
}));

// DELETE /yipnet/posts/:id
router.delete('/:id', authRequired, asyncRoute(async (req, res) => {
    const postId = Number(req.params.id);

    if (!validId(postId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const [posts] = await pool.execute(
        `SELECT owner_id
         FROM posts
         WHERE id = ?
         LIMIT 1`,
        [postId]
    );

    if (!posts.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Post no encontrado.'
        });
    }

    if (posts[0].owner_id !== req.userId) {
        return res.status(403).json({
            status: 'error',
            message: 'No puedes borrar este post.'
        });
    }

    await pool.execute(
        `DELETE FROM posts
         WHERE id = ?
         LIMIT 1`,
        [postId]
    );

    return res.json({
        status: 'success',
        message: 'Post eliminado correctamente.'
    });
}));

module.exports = router;