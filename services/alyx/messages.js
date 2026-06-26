const express = require('express')

const pool = require('../../utils/db_conn')
const { authRequired } = require('../../utils/auth')
const { asyncRoute } = require('../../utils/route')

const router = express.Router()
const fs = require('fs')
const path = require('path')

const OpenAI = require('openai')
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})
const ALYX_MODEL = process.env.ALYX_MODEL || 'gpt-5.5'

function cleanText(value) {
    return String(value || '').trim()
}

async function chatBelongsToUser(chatId, userId) {
    const [chats] = await pool.execute(
        `SELECT id
         FROM alyx_chats
         WHERE id = ? AND owner_id = ?
         LIMIT 1`,
        [chatId, userId]
    )

    return !!chats.length
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

function sendSse(res, payload) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function setupSse(res) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()
}

function setupSse(res) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    res.flushHeaders?.()
    res.write(':\n\n')
}

function sendSse(res, payload) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
    res.flush?.()
}

// GET /alyx/messages/chat/:chatId
router.get('/chat/:chatId', authRequired, asyncRoute(async (req, res) => {
    const chatId = Number(req.params.chatId)

    if (!Number.isFinite(chatId) || chatId <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Chat inválido.'
        })
    }

    const validChat = await chatBelongsToUser(chatId, req.userId)

    if (!validChat) {
        return res.status(404).json({
            status: 'error',
            message: 'Chat no encontrado.'
        })
    }

    const [messages] = await pool.execute(
        `SELECT
            id,
            chat_id,
            role,
            content,
            metadata,
            created_at
         FROM alyx_messages
         WHERE chat_id = ?
         ORDER BY created_at ASC, id ASC`,
        [chatId]
    )

    return res.json({
        status: 'success',
        data: messages
    })
}))

// POST /alyx/messages/chat/:chatId
router.post('/chat/:chatId', authRequired, asyncRoute(async (req, res) => {
    const chatId = Number(req.params.chatId)
    const content = cleanText(req.body.content)
    const role = cleanText(req.body.role) || 'user'

    const validRoles = ['user', 'assistant', 'system', 'tool']

    if (!Number.isFinite(chatId) || chatId <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Chat inválido.'
        })
    }

    if (!validRoles.includes(role)) {
        return res.status(400).json({
            status: 'error',
            message: 'Rol inválido.'
        })
    }

    if (!content) {
        return res.status(400).json({
            status: 'error',
            message: 'El mensaje no puede estar vacío.'
        })
    }

    const validChat = await chatBelongsToUser(chatId, req.userId)

    if (!validChat) {
        return res.status(404).json({
            status: 'error',
            message: 'Chat no encontrado.'
        })
    }

    const metadata = req.body.metadata || {}

    const [result] = await pool.execute(
        `INSERT INTO alyx_messages
            (chat_id, role, content, metadata)
         VALUES
            (?, ?, ?, ?)`,
        [
            chatId,
            role,
            content,
            JSON.stringify(metadata)
        ]
    )

    await pool.execute(
        `UPDATE alyx_chats
         SET updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [chatId]
    )

    const [messages] = await pool.execute(
        `SELECT
            id,
            chat_id,
            role,
            content,
            metadata,
            created_at
         FROM alyx_messages
         WHERE id = ?
         LIMIT 1`,
        [result.insertId]
    )

    return res.status(201).json({
        status: 'success',
        data: messages[0]
    })
}))

// POST /alyx/messages/chat/:chatId/respond
router.post('/chat/:chatId/respond', authRequired, asyncRoute(async (req, res) => {
    const chatId = Number(req.params.chatId)
    const content = cleanText(req.body.content)

    if (!Number.isFinite(chatId) || chatId <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Chat inválido.'
        })
    }

    if (!content) {
        return res.status(400).json({
            status: 'error',
            message: 'El mensaje no puede estar vacío.'
        })
    }

    const [chats] = await pool.execute(
        `SELECT
            c.id,
            c.owner_id,
            c.project_id,
            c.title,
            c.model,
            p.memory AS project_memory
         FROM alyx_chats c
         LEFT JOIN alyx_projects p ON p.id = c.project_id
         WHERE c.id = ? AND c.owner_id = ?
         LIMIT 1`,
        [chatId, req.userId]
    )

    if (!chats.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Chat no encontrado.'
        })
    }

    const chat = chats[0]

    const fileIds = Array.isArray(req.body.file_ids)
        ? req.body.file_ids.map(Number).filter(Number.isFinite)
        : [];

    const attachments = await getMediaData(fileIds)

    const userMetadata = {
        file_ids: fileIds,
        attachments
    }

    let inputFiles = []

    if (fileIds.length) {
        const placeholders = fileIds.map(() => '?').join(',')

        const [files] = await pool.execute(
            `SELECT id, rel_path, mime_type
            FROM files
            WHERE id IN (${placeholders})`,
            fileIds
        )

        for (const file of files) {
            const parts = file.rel_path.split('/')
            const ownerId = Number(parts[1])

            if (parts[0] !== 'alyx' || ownerId !== req.userId) {
                return res.status(403).json({
                    status: 'error',
                    message: 'No puedes usar uno de estos archivos.'
                })
            }

            if (String(file.mime_type || '').startsWith('image/')) {
                const absolutePath = path.join(__dirname, '../../storage', file.rel_path)
                const buffer = fs.readFileSync(absolutePath)
                const base64 = buffer.toString('base64')

                inputFiles.push({
                    type: 'input_image',
                    image_url: `data:${file.mime_type};base64,${base64}`
                })
            }
        }
    }

    const [userResult] = await pool.execute(
        `INSERT INTO alyx_messages
            (chat_id, role, content, metadata)
         VALUES
            (?, 'user', ?, ?)`,
        [
            chatId,
            content,
            JSON.stringify(userMetadata)
        ]
    )

    const [userMessages] = await pool.execute(
        `SELECT
            id,
            chat_id,
            role,
            content,
            metadata,
            created_at
         FROM alyx_messages
         WHERE id = ?
         LIMIT 1`,
        [userResult.insertId]
    )

    const [history] = await pool.execute(
        `SELECT role, content
         FROM alyx_messages
         WHERE chat_id = ?
         ORDER BY created_at ASC, id ASC
         LIMIT 30`,
        [chatId]
    )

    const instructions = [
        'You are Alyx, an assistant inside Alexicon.',
        'Answer clearly, warmly and helpfully.',
        'Use the same language as the user when possible.',
        chat.project_memory
            ? `Project memory:\n${chat.project_memory}`
            : ''
    ].filter(Boolean).join('\n\n')

    const input = history.slice(0, -1).map(message => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
    }))

    input.push({
        role: 'user',
        content: [
            {
                type: 'input_text',
                text: content || 'Describe the attached files.'
            },
            ...inputFiles
        ]
    })

    const response = await openai.responses.create({
        model: chat.model || ALYX_MODEL,
        instructions,
        input
    })

    const assistantContent =
        response.output_text ||
        'No pude generar una respuesta.'

    const [assistantResult] = await pool.execute(
        `INSERT INTO alyx_messages
            (chat_id, role, content, metadata)
         VALUES
            (?, 'assistant', ?, ?)`,
        [
            chatId,
            assistantContent,
            JSON.stringify({
                model: chat.model || ALYX_MODEL,
                response_id: response.id || null
            })
        ]
    )

    await pool.execute(
        `UPDATE alyx_chats
         SET updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [chatId]
    )

    const [assistantMessages] = await pool.execute(
        `SELECT
            id,
            chat_id,
            role,
            content,
            metadata,
            created_at
         FROM alyx_messages
         WHERE id = ?
         LIMIT 1`,
        [assistantResult.insertId]
    )

    return res.status(201).json({
        status: 'success',
        data: {
            user_message: userMessages[0],
            assistant_message: assistantMessages[0]
        }
    })
}))

// POST /alyx/messages/chat/:chatId/respond-stream
router.post('/chat/:chatId/respond-stream', authRequired, asyncRoute(async (req, res) => {
    const chatId = Number(req.params.chatId)
    const content = cleanText(req.body.content)

    const fileIds = Array.isArray(req.body.file_ids)
        ? req.body.file_ids.map(Number).filter(Number.isFinite)
        : []

    if (!Number.isFinite(chatId) || chatId <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Chat inválido.'
        })
    }

    if (!content && !fileIds.length) {
        return res.status(400).json({
            status: 'error',
            message: 'El mensaje no puede estar vacío.'
        })
    }

    setupSse(res)

    try {
        const [chats] = await pool.execute(
            `SELECT
                c.id,
                c.owner_id,
                c.project_id,
                c.title,
                c.model,
                p.memory AS project_memory
             FROM alyx_chats c
             LEFT JOIN alyx_projects p ON p.id = c.project_id
             WHERE c.id = ? AND c.owner_id = ?
             LIMIT 1`,
            [chatId, req.userId]
        )

        if (!chats.length) {
            sendSse(res, {
                type: 'error',
                message: 'Chat no encontrado.'
            })
            return res.end()
        }

        const chat = chats[0]
        const attachments = await getMediaData(fileIds)

        const userMetadata = {
            file_ids: fileIds,
            attachments
        }

        let inputFiles = []

        if (fileIds.length) {
            const placeholders = fileIds.map(() => '?').join(',')

            const [files] = await pool.execute(
                `SELECT id, rel_path, mime_type
                 FROM files
                 WHERE id IN (${placeholders})`,
                fileIds
            )

            for (const file of files) {
                const parts = file.rel_path.split('/')
                const ownerId = Number(parts[1])

                if (parts[0] !== 'alyx' || ownerId !== req.userId) {
                    sendSse(res, {
                        type: 'error',
                        message: 'No puedes usar uno de estos archivos.'
                    })
                    return res.end()
                }

                if (String(file.mime_type || '').startsWith('image/')) {
                    const absolutePath = path.join(__dirname, '../../storage', file.rel_path)
                    const buffer = fs.readFileSync(absolutePath)
                    const base64 = buffer.toString('base64')

                    inputFiles.push({
                        type: 'input_image',
                        image_url: `data:${file.mime_type};base64,${base64}`
                    })
                }
            }
        }

        const [userResult] = await pool.execute(
            `INSERT INTO alyx_messages
                (chat_id, role, content, metadata)
             VALUES
                (?, 'user', ?, ?)`,
            [
                chatId,
                content,
                JSON.stringify(userMetadata)
            ]
        )

        const [userMessages] = await pool.execute(
            `SELECT
                id,
                chat_id,
                role,
                content,
                metadata,
                created_at
             FROM alyx_messages
             WHERE id = ?
             LIMIT 1`,
            [userResult.insertId]
        )

        sendSse(res, {
            type: 'user_message',
            message: userMessages[0]
        })

        const [history] = await pool.execute(
            `SELECT role, content
             FROM alyx_messages
             WHERE chat_id = ?
             ORDER BY created_at ASC, id ASC
             LIMIT 30`,
            [chatId]
        )

        const instructions = [
            'You are Alyx, an assistant inside Alexicon.',
            'Answer clearly, warmly and helpfully.',
            'Use the same language as the user when possible.',
            chat.project_memory
                ? `Project memory:\n${chat.project_memory}`
                : ''
        ].filter(Boolean).join('\n\n')

        const input = history.slice(0, -1).map(message => ({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content
        }))

        input.push({
            role: 'user',
            content: [
                {
                    type: 'input_text',
                    text: content || 'Describe the attached files.'
                },
                ...inputFiles
            ]
        })

        const stream = await openai.responses.create({
            model: chat.model || ALYX_MODEL,
            instructions,
            input,
            stream: true
        })

        let assistantContent = ''
        let responseId = null

        for await (const event of stream) {
            if (event.type === 'response.created') {
                responseId = event.response?.id || null
            }

            const delta =
                event.type === 'response.output_text.delta'
                    ? event.delta
                    : event.type === 'response.output.delta'
                        ? event.delta?.text
                        : ''

            if (delta) {
                assistantContent += delta

                sendSse(res, {
                    type: 'delta',
                    text: delta
                })
            }

            if (event.type === 'response.completed') {
                responseId = event.response?.id || responseId
            }

            if (event.type === 'response.failed' || event.type === 'response.error') {
                sendSse(res, {
                    type: 'error',
                    message:
                        event.response?.error?.message ||
                        event.error?.message ||
                        'Error generando respuesta.'
                })
            }
        }

        if (!assistantContent.trim()) {
            assistantContent = 'No pude generar una respuesta.'
        }

        const [assistantResult] = await pool.execute(
            `INSERT INTO alyx_messages
                (chat_id, role, content, metadata)
             VALUES
                (?, 'assistant', ?, ?)`,
            [
                chatId,
                assistantContent,
                JSON.stringify({
                    model: chat.model || ALYX_MODEL,
                    response_id: responseId
                })
            ]
        )

        await pool.execute(
            `UPDATE alyx_chats
             SET updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [chatId]
        )

        const [assistantMessages] = await pool.execute(
            `SELECT
                id,
                chat_id,
                role,
                content,
                metadata,
                created_at
             FROM alyx_messages
             WHERE id = ?
             LIMIT 1`,
            [assistantResult.insertId]
        )

        sendSse(res, {
            type: 'done',
            message: assistantMessages[0]
        })

        return res.end()
    } catch (error) {
        console.error(error)

        sendSse(res, {
            type: 'error',
            message: error.message || 'Error interno.'
        })

        return res.end()
    }
}))

module.exports = router