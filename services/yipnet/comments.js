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
    if (Array.isArray(value)) return value;

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function commentSelectFields() {
    return `
        c.id, c.post_id, c.parent_id, c.owner_id, c.content, c.media,
        c.ai_generated, c.comment_date, c.origin,
        u.name, u.surname, u.nickname, u.at_sign, u.profile_pic
    `;
}

async function getMediaData(mediaIds) {
    if (!mediaIds.length) return [];

    const cleanIds = mediaIds
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && id > 0);

    if (!cleanIds.length) return [];

    const placeholders = cleanIds.map(() => '?').join(',');

    const [rows] = await pool.execute(
        `SELECT id, rel_path, mime_type, size, visibility
         FROM files
         WHERE id IN (${placeholders})`,
        cleanIds
    );

    const byId = new Map(rows.map(row => [Number(row.id), row]));

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
        }));
}

function normalizeComment(comment) {
    return {
        ...comment,
        media: parseJsonArray(comment.media),
        ai_generated: !!comment.ai_generated
    };
}

async function getCommentVotes(commentId, viewerId) {
    const [voteRows] = await pool.execute(
        `SELECT vote_type, COUNT(*) AS count
         FROM votes
         WHERE target_type = 'comment'
           AND target_id = ?
         GROUP BY vote_type`,
        [commentId]
    );

    const votes = {
        heart: 0,
        up: 0,
        down: 0
    };

    for (const row of voteRows) {
        votes[row.vote_type] = Number(row.count);
    }

    let my_vote = null;

    if (viewerId) {
        const [myVoteRows] = await pool.execute(
            `SELECT vote_type
             FROM votes
             WHERE user_id = ?
               AND target_type = 'comment'
               AND target_id = ?
             LIMIT 1`,
            [viewerId, commentId]
        );

        my_vote = myVoteRows[0]?.vote_type || null;
    }

    return {
        votes,
        viewer: {
            my_vote
        }
    };
}

async function normalizeCommentWithMedia(comment, viewerId = null) {
    const normalized = normalizeComment(comment);

    normalized.media = await getMediaData(normalized.media);

    const { votes, viewer } = await getCommentVotes(normalized.id, viewerId);

    normalized.votes = votes;
    normalized.viewer = viewer;

    return normalized;
}

async function normalizeCommentsWithMedia(comments, viewerId = null) {
    return Promise.all(
        comments.map(comment => normalizeCommentWithMedia(comment, viewerId))
    );
}

// POST /yipnet/comments/post/:postId
router.post('/post/:postId', authRequired, asyncRoute(async (req, res) => {
    const postId = Number(req.params.postId);
    const parentId = req.body.parent_id ? Number(req.body.parent_id) : null;
    const { content, media, ai_generated = 0 } = req.body;

    if (!validId(postId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID de post inválido.'
        });
    }

    if (!content || !String(content).trim()) {
        return res.status(400).json({
            status: 'error',
            message: 'El comentario no puede estar vacío.'
        });
    }

    const [posts] = await pool.execute(
        `SELECT owner_id, private_post
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

    const post = posts[0];

    if (post.private_post && post.owner_id !== req.userId) {
        return res.status(403).json({
            status: 'error',
            message: 'No puedes comentar este post.'
        });
    }

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
            message: 'No puedes comentar este post.'
        });
    }   

    const [result] = await pool.execute(
        `INSERT INTO comments
         (post_id, parent_id, owner_id, content, media, ai_generated, origin)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            postId,
            parentId,
            req.userId,
            String(content).trim(),
            JSON.stringify(parseJsonArray(media)),
            ai_generated ? 1 : 0,
            req.headers.origin || null
        ]
    );

    const commentId = result.insertId;

    // notifications:
    if (Number(post.owner_id) !== Number(req.userId)) {
        try {
            const [users] = await pool.execute(
                `SELECT id, name, surname, nickname, at_sign, profile_pic
                FROM users
                WHERE id = ?
                LIMIT 1`,
                [req.userId]
            );
            await emitNotification(post.owner_id, 'comment', 'yipnet', {
                message: 'You have a new comment',
                user: users[0] || null,
                postId,
                commentId,
                timestamp: new Date().toISOString()
            });
        } catch (notifyErr) {
            console.error('emitNotification error (comment):', notifyErr);
        }
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

            await emitNotification(user.id, 'mention', 'yipnet', {
                message: 'You were mentioned in a comment',
                user: author,
                mentionedUser: user,
                entityType: 'comment',
                postId,
                commentId,
                targetId: commentId,
                preview: String(content || '').trim().slice(0, 160),
                timestamp: new Date().toISOString()
            })
        }
    }

    return res.status(201).json({
        status: 'success',
        message: 'Comentario creado correctamente.',
        data: {
            id: commentId
        }
    });
}));

// GET /yipnet/comments/post/:postId?limit=20&offset=0
router.get('/post/:postId', authOptional, asyncRoute(async (req, res) => {
    const postId = Number(req.params.postId);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    if (!validId(postId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID de post inválido.'
        });
    }

    const [posts] = await pool.execute(
        `SELECT owner_id, private_post
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

    const post = posts[0];

    if (post.private_post && post.owner_id !== req.userId) {
        return res.status(403).json({
            status: 'error',
            message: 'No puedes ver los comentarios de este post.'
        });
    }

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
                message: 'No puedes ver los comentarios de este post.'
            });
        }
    }

    const [rows] = await pool.execute(
        `SELECT ${commentSelectFields()}
         FROM comments c
         INNER JOIN users u ON u.id = c.owner_id
         WHERE c.post_id = ?
         ORDER BY c.comment_date ASC
         LIMIT ? OFFSET ?`,
        [postId, limit, offset]
    );

    return res.json({
        status: 'success',
        data: {
            comments: await normalizeCommentsWithMedia(rows, req.userId),
            pagination: {
                limit,
                offset,
                next_offset: rows.length === limit ? offset + limit : null
            }
        }
    });
}));

// GET /yipnet/comments/:id
router.get('/:id', authOptional, asyncRoute(async (req, res) => {
    const commentId = Number(req.params.id);

    if (!validId(commentId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const [rows] = await pool.execute(
        `SELECT ${commentSelectFields()}, p.owner_id AS post_owner_id, p.private_post
         FROM comments c
         INNER JOIN users u ON u.id = c.owner_id
         INNER JOIN posts p ON p.id = c.post_id
         WHERE c.id = ?
         LIMIT 1`,
        [commentId]
    );

    if (!rows.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Comentario no encontrado.'
        });
    }

    const comment = await normalizeCommentWithMedia(rows[0], req.userId);

    if (comment.private_post && comment.post_owner_id !== req.userId) {
        return res.status(403).json({
            status: 'error',
            message: 'No puedes ver este comentario.'
        });
    }

    if (req.userId && req.userId !== comment.post_owner_id && req.userId !== comment.owner_id) {
        const [blocked] = await pool.execute(
            `SELECT 1
             FROM blocks
             WHERE (blocker_id = ? AND blocked_id IN (?, ?))
                OR (blocked_id = ? AND blocker_id IN (?, ?))
             LIMIT 1`,
            [
                req.userId,
                comment.post_owner_id,
                comment.owner_id,
                req.userId,
                comment.post_owner_id,
                comment.owner_id
            ]
        );

        if (blocked.length) {
            return res.status(403).json({
                status: 'error',
                message: 'No puedes ver este comentario.'
            });
        }
    }

    const [voteRows] = await pool.execute(
        `SELECT vote_type, COUNT(*) AS count
         FROM votes
         WHERE target_type = 'comment'
           AND target_id = ?
         GROUP BY vote_type`,
        [commentId]
    );

    const votes = {
        heart: 0,
        up: 0,
        down: 0
    };

    for (const row of voteRows) {
        votes[row.vote_type] = row.count;
    }

    let my_vote = null;

    if (req.userId) {
        const [myVoteRows] = await pool.execute(
            `SELECT vote_type
             FROM votes
             WHERE user_id = ?
               AND target_type = 'comment'
               AND target_id = ?
             LIMIT 1`,
            [req.userId, commentId]
        );

        my_vote = myVoteRows[0]?.vote_type || null;
    }

    return res.json({
        status: 'success',
        data: {
            ...comment,
            votes,
            viewer: {
                my_vote
            }
        }
    });
}));

// PATCH /yipnet/comments/:id
router.patch('/:id', authRequired, asyncRoute(async (req, res) => {
    const commentId = Number(req.params.id);
    const { content, media } = req.body;

    if (!validId(commentId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const [comments] = await pool.execute(
        `SELECT owner_id
         FROM comments
         WHERE id = ?
         LIMIT 1`,
        [commentId]
    );

    if (!comments.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Comentario no encontrado.'
        });
    }

    if (comments[0].owner_id !== req.userId) {
        return res.status(403).json({
            status: 'error',
            message: 'No puedes editar este comentario.'
        });
    }

    const updates = [];
    const values = [];

    if (content !== undefined) {
        if (!String(content).trim()) {
            return res.status(400).json({
                status: 'error',
                message: 'El comentario no puede quedar vacío.'
            });
        }

        updates.push('content = ?');
        values.push(String(content).trim());
    }

    if (media !== undefined) {
        updates.push('media = ?');
        values.push(JSON.stringify(parseJsonArray(media)));
    }

    if (!updates.length) {
        return res.status(400).json({
            status: 'error',
            message: 'No hay campos para actualizar.'
        });
    }

    values.push(commentId);

    await pool.execute(
        `UPDATE comments
         SET ${updates.join(', ')}
         WHERE id = ?
         LIMIT 1`,
        values
    );

    return res.json({
        status: 'success',
        message: 'Comentario actualizado correctamente.'
    });
}));

// DELETE /yipnet/comments/:id
router.delete('/:id', authRequired, asyncRoute(async (req, res) => {
    const commentId = Number(req.params.id);

    if (!validId(commentId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const [comments] = await pool.execute(
        `SELECT c.owner_id, p.owner_id AS post_owner_id
         FROM comments c
         INNER JOIN posts p ON p.id = c.post_id
         WHERE c.id = ?
         LIMIT 1`,
        [commentId]
    );

    if (!comments.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Comentario no encontrado.'
        });
    }

    const comment = comments[0];

    if (comment.owner_id !== req.userId && comment.post_owner_id !== req.userId) {
        return res.status(403).json({
            status: 'error',
            message: 'No puedes borrar este comentario.'
        });
    }

    await pool.execute(
        `DELETE FROM comments
         WHERE id = ?
         LIMIT 1`,
        [commentId]
    );

    return res.json({
        status: 'success',
        message: 'Comentario eliminado correctamente.'
    });
}));

module.exports = router;