const express = require('express');

const pool = require('../../utils/db_conn');
const { authRequired } = require('../../utils/auth');
const { asyncRoute } = require('../../utils/route');
const { hydrateMedia } = require('../../utils/media');
const { emitNotification } = require('../../utils/socket');

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

async function getMyConversationRole(conversationId, userId) {
    const [rows] = await pool.execute(
        `SELECT role
         FROM conversation_participants
         WHERE conversation_id = ?
           AND user_id = ?
         LIMIT 1`,
        [conversationId, userId]
    )

    return rows[0]?.role || null
}

async function isGroupConversation(conversationId) {
    const [rows] = await pool.execute(
        `SELECT COUNT(*) AS total
         FROM conversation_participants
         WHERE conversation_id = ?`,
        [conversationId]
    )

    return Number(rows[0]?.total || 0) > 2
}

function canManageMembers(role) {
    return ['owner', 'admin'].includes(role)
}

// GET /yipnet/messages/conversations
router.get('/conversations', authRequired, asyncRoute(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [rows] = await pool.execute(
        `SELECT 
            c.id,
            c.name,
            c.current_group_pic,
            cp.role,
            cp.joined_at,
            (
                SELECT m.content
                FROM messages m
                WHERE m.conversation_id = c.id
                  AND m.deleted = 0
                ORDER BY m.msg_date DESC
                LIMIT 1
            ) AS last_message,
            (
                SELECT m.msg_date
                FROM messages m
                WHERE m.conversation_id = c.id
                  AND m.deleted = 0
                ORDER BY m.msg_date DESC
                LIMIT 1
            ) AS last_message_date
         FROM conversation_participants cp
         INNER JOIN conversations c ON c.id = cp.conversation_id
         WHERE cp.user_id = ?
         ORDER BY COALESCE(last_message_date, cp.joined_at) DESC
         LIMIT ? OFFSET ?`,
        [req.userId, limit, offset]
    );

    const conversationIds = rows.map(row => row.id);

    let participantsByConversation = new Map();

    if (conversationIds.length) {
        const placeholders = conversationIds.map(() => '?').join(',');

        const [participants] = await pool.execute(
            `SELECT
                cp.conversation_id,
                cp.user_id,
                cp.role,
                u.name,
                u.surname,
                u.nickname,
                u.at_sign,
                u.profile_pic
             FROM conversation_participants cp
             INNER JOIN users u ON u.id = cp.user_id
             WHERE cp.conversation_id IN (${placeholders})
             ORDER BY cp.joined_at ASC`,
            conversationIds
        );

        for (const participant of participants) {
            if (!participantsByConversation.has(participant.conversation_id)) {
                participantsByConversation.set(participant.conversation_id, []);
            }

            participantsByConversation.get(participant.conversation_id).push({
                id: participant.user_id,
                role: participant.role,
                name: participant.name,
                surname: participant.surname,
                nickname: participant.nickname,
                at_sign: participant.at_sign,
                profile_pic: participant.profile_pic
            });
        }
    }

    const conversations = rows.map(row => {
        const participants = participantsByConversation.get(row.id) || [];
        const otherParticipants = participants.filter(
            user => Number(user.id) !== Number(req.userId)
        );

        return {
            ...row,
            participants,
            other_participants: otherParticipants,
            is_group: participants.length > 2,
            display_name: participants.length > 2
                ? row.name
                : `${otherParticipants[0]?.name || ''} ${otherParticipants[0]?.surname || ''}`.trim(),
            display_pic: participants.length > 2
                ? row.current_group_pic
                : otherParticipants[0]?.profile_pic || null
        };
    });

    return res.json({
        status: 'success',
        data: {
            conversations,
            pagination: {
                limit,
                offset,
                next_offset: rows.length === limit ? offset + limit : null
            }
        }
    });
}));

// GET /yipnet/messages/conversations/:id
router.get('/conversations/:id', authRequired, asyncRoute(async (req, res) => {
    const conversationId = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    if (!validId(conversationId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const [participant] = await pool.execute(
        `SELECT role
         FROM conversation_participants
         WHERE conversation_id = ?
           AND user_id = ?
         LIMIT 1`,
        [conversationId, req.userId]
    );

    if (!participant.length) {
        return res.status(403).json({
            status: 'error',
            message: 'No perteneces a esta conversación.'
        });
    }

    const [messages] = await pool.execute(
        `SELECT 
            m.id,
            m.sender_id,
            m.receiver_id,
            m.conversation_id,
            m.content,
            m.media,
            m.deleted,
            m.msg_date,
            u.name,
            u.surname,
            u.nickname,
            u.at_sign,
            u.profile_pic
         FROM messages m
         INNER JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = ?
         ORDER BY m.msg_date DESC
         LIMIT ? OFFSET ?`,
        [conversationId, limit, offset]
    );

    for (const message of messages) {
        message.media = await hydrateMedia(message.media)
    }

    const messageIds = messages.map(message => message.id)

    if (messageIds.length) {
        const placeholders = messageIds.map(() => '?').join(',')

        const [voteRows] = await pool.execute(
            `SELECT target_id, vote_type, COUNT(*) AS count
            FROM votes
            WHERE target_type = 'message'
            AND target_id IN (${placeholders})
            GROUP BY target_id, vote_type`,
            messageIds
        )

        const [myVoteRows] = await pool.execute(
            `SELECT target_id, vote_type
            FROM votes
            WHERE target_type = 'message'
            AND target_id IN (${placeholders})
            AND user_id = ?`,
            [...messageIds, req.userId]
        )

        const votesMap = {}
        const myVotesMap = {}

        for (const id of messageIds) {
            votesMap[id] = {
                up: 0,
                down: 0,
                heart: 0
            }
        }

        for (const row of voteRows) {
            votesMap[row.target_id][row.vote_type] = Number(row.count)
        }

        for (const row of myVoteRows) {
            myVotesMap[row.target_id] = row.vote_type
        }

        for (const message of messages) {
            message.votes = votesMap[message.id] || {
                up: 0,
                down: 0,
                heart: 0
            }

            message.viewer = {
                my_vote: myVotesMap[message.id] || null
            }
        }
    }

    return res.json({
        status: 'success',
        data: {
            messages: messages.reverse(),
            pagination: {
                limit,
                offset,
                next_offset: messages.length === limit ? offset + limit : null
            }
        }
    });
}));

// POST /yipnet/messages/conversations
router.post('/conversations', authRequired, asyncRoute(async (req, res) => {
    const { name, participants = [], current_group_pic = null } = req.body;

    const cleanParticipants = [...new Set(
        parseJsonArray(participants)
            .map(Number)
            .filter(id => validId(id) && id !== req.userId)
    )];

    if (cleanParticipants.length < 2) {
        return res.status(400).json({
            status: 'error',
            message: 'Para crear un grupo necesitas al menos 2 participantes además de ti.'
        });
    }

    const conversationName = String(name || '').trim() || 'New group';

    if (conversationName.length > 63) {
        return res.status(400).json({
            status: 'error',
            message: 'El nombre del grupo no puede superar 63 caracteres.'
        });
    }

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [result] = await conn.execute(
            `INSERT INTO conversations (name, current_group_pic)
             VALUES (?, ?)`,
            [conversationName, current_group_pic]
        );

        const conversationId = result.insertId;

        await conn.execute(
            `INSERT INTO conversation_participants
             (conversation_id, user_id, role)
             VALUES (?, ?, 'owner')`,
            [conversationId, req.userId]
        );

        for (const userId of cleanParticipants) {
            await conn.execute(
                `INSERT IGNORE INTO conversation_participants
                 (conversation_id, user_id, role)
                 VALUES (?, ?, 'member')`,
                [conversationId, userId]
            );
        }

        await conn.commit();

        return res.status(201).json({
            status: 'success',
            message: 'Conversación creada correctamente.',
            data: {
                conversation_id: conversationId
            }
        });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}));

// POST /yipnet/messages/direct/:userId
router.post('/direct/:userId', authRequired, asyncRoute(async (req, res) => {
    const otherUserId = Number(req.params.userId)

    if (!validId(otherUserId) || otherUserId === req.userId) {
        return res.status(400).json({
            status: 'error',
            message: 'Usuario inválido.'
        })
    }

    const [users] = await pool.execute(
        `SELECT id FROM users WHERE id = ? LIMIT 1`,
        [otherUserId]
    )

    if (!users.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Usuario no encontrado.'
        })
    }

    const [existing] = await pool.execute(
        `SELECT cp1.conversation_id
         FROM conversation_participants cp1
         INNER JOIN conversation_participants cp2
            ON cp2.conversation_id = cp1.conversation_id
         INNER JOIN conversations c
            ON c.id = cp1.conversation_id
         WHERE cp1.user_id = ?
           AND cp2.user_id = ?
           AND (
                SELECT COUNT(*)
                FROM conversation_participants cp3
                WHERE cp3.conversation_id = cp1.conversation_id
           ) = 2
         LIMIT 1`,
        [req.userId, otherUserId]
    )

    if (existing.length) {
        return res.json({
            status: 'success',
            data: {
                conversation_id: existing[0].conversation_id,
                existed: true
            }
        })
    }

    const conn = await pool.getConnection()

    try {
        await conn.beginTransaction()

        const [result] = await conn.execute(
            `INSERT INTO conversations (name)
             VALUES (?)`,
            ['Direct message']
        )

        const conversationId = result.insertId

        await conn.execute(
            `INSERT INTO conversation_participants
             (conversation_id, user_id, role)
             VALUES (?, ?, 'owner'), (?, ?, 'member')`,
            [conversationId, req.userId, conversationId, otherUserId]
        )

        await conn.commit()

        return res.status(201).json({
            status: 'success',
            data: {
                conversation_id: conversationId,
                existed: false
            }
        })
    } catch (error) {
        await conn.rollback()
        throw error
    } finally {
        conn.release()
    }
}))

// PATCH /yipnet/messages/conversations/:id
router.patch('/conversations/:id', authRequired, asyncRoute(async (req, res) => {
    const conversationId = Number(req.params.id);
    const { name, current_group_pic } = req.body;

    if (!validId(conversationId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const [me] = await pool.execute(
        `SELECT role
         FROM conversation_participants
         WHERE conversation_id = ?
           AND user_id = ?
         LIMIT 1`,
        [conversationId, req.userId]
    );

    if (!me.length) {
        return res.status(403).json({
            status: 'error',
            message: 'No perteneces a esta conversación.'
        });
    }

    if (!['owner', 'admin'].includes(me[0].role)) {
        return res.status(403).json({
            status: 'error',
            message: 'Solo owners y admins pueden editar esta conversación.'
        });
    }

    const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total
         FROM conversation_participants
         WHERE conversation_id = ?`,
        [conversationId]
    );

    if (Number(countRows[0].total) <= 2) {
        return res.status(400).json({
            status: 'error',
            message: 'Los chats directos no tienen título editable.'
        });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
        const cleanName = String(name || '').trim();

        if (!cleanName) {
            return res.status(400).json({
                status: 'error',
                message: 'El nombre no puede estar vacío.'
            });
        }

        if (cleanName.length > 63) {
            return res.status(400).json({
                status: 'error',
                message: 'El nombre no puede superar 63 caracteres.'
            });
        }

        updates.push('name = ?');
        values.push(cleanName);
    }

    if (current_group_pic !== undefined) {
        updates.push('current_group_pic = ?');
        values.push(current_group_pic || null);
    }

    if (!updates.length) {
        return res.status(400).json({
            status: 'error',
            message: 'No hay campos para actualizar.'
        });
    }

    values.push(conversationId);

    await pool.execute(
        `UPDATE conversations
         SET ${updates.join(', ')}
         WHERE id = ?
         LIMIT 1`,
        values
    );

    return res.json({
        status: 'success',
        message: 'Conversación actualizada correctamente.'
    });
}));

// DELETE /yipnet/messages/conversations/:id/leave
router.delete('/conversations/:id/leave', authRequired, asyncRoute(async (req, res) => {
    const conversationId = Number(req.params.id);

    if (!validId(conversationId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const [me] = await pool.execute(
        `SELECT role
         FROM conversation_participants
         WHERE conversation_id = ?
           AND user_id = ?
         LIMIT 1`,
        [conversationId, req.userId]
    );

    if (!me.length) {
        return res.status(403).json({
            status: 'error',
            message: 'No perteneces a esta conversación.'
        });
    }

    const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total
         FROM conversation_participants
         WHERE conversation_id = ?`,
        [conversationId]
    );

    const total = Number(countRows[0].total);

    if (total <= 2) {
        return res.status(400).json({
            status: 'error',
            message: 'No puedes salir de un chat directo.'
        });
    }

    if (me[0].role === 'owner') {
        const [owners] = await pool.execute(
            `SELECT COUNT(*) AS total
             FROM conversation_participants
             WHERE conversation_id = ?
               AND role = 'owner'`,
            [conversationId]
        );

        if (Number(owners[0].total) <= 1) {
            return res.status(400).json({
                status: 'error',
                message: 'Antes de salir, asigna otro owner.'
            });
        }
    }

    await pool.execute(
        `DELETE FROM conversation_participants
         WHERE conversation_id = ?
           AND user_id = ?
         LIMIT 1`,
        [conversationId, req.userId]
    );

    return res.json({
        status: 'success',
        message: 'Saliste de la conversación.'
    });
}));

// POST /yipnet/messages/conversations/:id/participants
router.post('/conversations/:id/participants', authRequired, asyncRoute(async (req, res) => {
    const conversationId = Number(req.params.id)
    const { participants = [] } = req.body

    if (!validId(conversationId)) {
        return res.status(400).json({ status: 'error', message: 'ID inválido.' })
    }

    const myRole = await getMyConversationRole(conversationId, req.userId)

    if (!myRole) {
        return res.status(403).json({ status: 'error', message: 'No perteneces a esta conversación.' })
    }

    if (!canManageMembers(myRole)) {
        return res.status(403).json({ status: 'error', message: 'No puedes agregar miembros.' })
    }

    const isGroup = await isGroupConversation(conversationId)

    if (!isGroup) {
        return res.status(400).json({ status: 'error', message: 'No puedes agregar miembros a un chat directo.' })
    }

    const cleanParticipants = [...new Set(
        parseJsonArray(participants)
            .map(Number)
            .filter(id => validId(id) && id !== req.userId)
    )]

    if (!cleanParticipants.length) {
        return res.status(400).json({ status: 'error', message: 'No hay usuarios para agregar.' })
    }

    for (const userId of cleanParticipants) {
        await pool.execute(
            `INSERT IGNORE INTO conversation_participants
             (conversation_id, user_id, role)
             VALUES (?, ?, 'member')`,
            [conversationId, userId]
        )
    }

    return res.json({
        status: 'success',
        message: 'Miembros agregados correctamente.'
    })
}));

// DELETE /yipnet/messages/conversations/:id/participants/:userId
router.delete('/conversations/:id/participants/:userId', authRequired, asyncRoute(async (req, res) => {
    const conversationId = Number(req.params.id)
    const targetUserId = Number(req.params.userId)

    if (!validId(conversationId) || !validId(targetUserId)) {
        return res.status(400).json({ status: 'error', message: 'ID inválido.' })
    }

    const myRole = await getMyConversationRole(conversationId, req.userId)
    const targetRole = await getMyConversationRole(conversationId, targetUserId)

    if (!myRole) {
        return res.status(403).json({ status: 'error', message: 'No perteneces a esta conversación.' })
    }

    if (!targetRole) {
        return res.status(404).json({ status: 'error', message: 'Usuario no pertenece a esta conversación.' })
    }

    if (!canManageMembers(myRole)) {
        return res.status(403).json({ status: 'error', message: 'No puedes eliminar miembros.' })
    }

    if (targetRole === 'owner' && myRole !== 'owner') {
        return res.status(403).json({ status: 'error', message: 'Solo un owner puede eliminar a otro owner.' })
    }

    if (targetUserId === req.userId) {
        return res.status(400).json({ status: 'error', message: 'Usa la opción de abandonar chat.' })
    }

    await pool.execute(
        `DELETE FROM conversation_participants
         WHERE conversation_id = ?
           AND user_id = ?
         LIMIT 1`,
        [conversationId, targetUserId]
    )

    return res.json({
        status: 'success',
        message: 'Miembro eliminado correctamente.'
    })
}));

// PATCH /yipnet/messages/conversations/:id/participants/:userId/role
router.patch('/conversations/:id/participants/:userId/role', authRequired, asyncRoute(async (req, res) => {
    const conversationId = Number(req.params.id)
    const targetUserId = Number(req.params.userId)
    const { role } = req.body

    const allowedRoles = ['member', 'admin', 'owner']

    if (!validId(conversationId) || !validId(targetUserId)) {
        return res.status(400).json({ status: 'error', message: 'ID inválido.' })
    }

    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ status: 'error', message: 'Rol inválido.' })
    }

    const myRole = await getMyConversationRole(conversationId, req.userId)
    const targetRole = await getMyConversationRole(conversationId, targetUserId)

    if (myRole !== 'owner') {
        return res.status(403).json({ status: 'error', message: 'Solo owners pueden cambiar roles.' })
    }

    if (!targetRole) {
        return res.status(404).json({ status: 'error', message: 'Usuario no pertenece a esta conversación.' })
    }

    await pool.execute(
        `UPDATE conversation_participants
         SET role = ?
         WHERE conversation_id = ?
           AND user_id = ?
         LIMIT 1`,
        [role, conversationId, targetUserId]
    )

    return res.json({
        status: 'success',
        message: 'Rol actualizado correctamente.'
    })
}));

// POST /yipnet/messages/conversations/:id
router.post('/conversations/:id', authRequired, asyncRoute(async (req, res) => {
    const conversationId = Number(req.params.id);
    const { content, media = [] } = req.body;

    if (!validId(conversationId)) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    if ((!content || !String(content).trim()) && !parseJsonArray(media).length) {
        return res.status(400).json({
            status: 'error',
            message: 'El mensaje necesita texto o media.'
        });
    }

    const [participant] = await pool.execute(
        `SELECT role
         FROM conversation_participants
         WHERE conversation_id = ?
           AND user_id = ?
         LIMIT 1`,
        [conversationId, req.userId]
    );

    if (!participant.length) {
        return res.status(403).json({
            status: 'error',
            message: 'No perteneces a esta conversación.'
        });
    }

    const [participants] = await pool.execute(
        `SELECT user_id
         FROM conversation_participants
         WHERE conversation_id = ?
           AND user_id != ?`,
        [conversationId, req.userId]
    );

    const receiverId = participants.length === 1 ? participants[0].user_id : null;

    const [result] = await pool.execute(
        `INSERT INTO messages
         (sender_id, receiver_id, conversation_id, content, media, origin)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            req.userId,
            receiverId,
            conversationId,
            content ? String(content).trim() : '',
            JSON.stringify(parseJsonArray(media)),
            req.headers.origin || null
        ]
    );

    const messageId = result.insertId;

    const [senderRows] = await pool.execute(
        `SELECT
            id,
            name,
            surname,
            nickname,
            at_sign,
            profile_pic
        FROM users
        WHERE id = ?
        LIMIT 1`,
        [req.userId]
    );

    const senderData = senderRows[0] || null;

    // notificar a todos menos al remitente:
    for (const participant of participants) {
        try {
            await emitNotification(
                participant.user_id,
                'message',
                'yipnet',
                {
                    messageId,
                    conversation_id: conversationId,
                    sender_id: req.userId,
                    user: senderData,
                    preview: String(content || '').trim().slice(0, 120),
                    timestamp: new Date().toISOString()
                }
            );
        } catch (notifyErr) {
            console.error(
                'emitNotification error (message):',
                notifyErr
            );
        }
    }

    return res.status(201).json({
        status: 'success',
        message: 'Mensaje enviado correctamente.',
        data: {
            id: messageId
        }
    });
}));

module.exports = router;