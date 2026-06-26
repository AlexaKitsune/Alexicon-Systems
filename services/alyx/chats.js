const express = require('express')
const router = express.Router()

const pool = require('../../utils/db_conn')
const { authRequired } = require('../../utils/auth')
const { asyncRoute } = require('../../utils/route')

function cleanText(value) {
    return String(value || '').trim()
}

async function projectBelongsToUser(projectId, userId) {
    if (!projectId) return true

    const [projects] = await pool.execute(`
        SELECT id
        FROM alyx_projects
        WHERE id = ? AND owner_id = ?
        LIMIT 1
    `, [projectId, userId])

    return !!projects.length
}

// GET /alyx/chats
router.get('/', authRequired, asyncRoute(async (req, res) => {
    const projectId = req.query.project_id || null

    const values = [req.userId]
    let projectFilter = ''

    if (projectId) {
        projectFilter = 'AND c.project_id = ?'
        values.push(projectId)
    }

    const [chats] = await pool.execute(`
        SELECT
            c.id,
            c.owner_id,
            c.project_id,
            c.title,
            c.model,
            c.created_at,
            c.updated_at,
            p.name AS project_name
        FROM alyx_chats c
        LEFT JOIN alyx_projects p ON p.id = c.project_id
        WHERE c.owner_id = ?
        ${projectFilter}
        ORDER BY c.updated_at DESC, c.id DESC
    `, values)

    res.json({
        status: 'success',
        data: chats
    })
}))

// POST /alyx/chats
router.post('/', authRequired, asyncRoute(async (req, res) => {
    const title = cleanText(req.body.title) || 'Untitled chat'
    const model = cleanText(req.body.model) || null
    const projectId = req.body.project_id || null

    const validProject = await projectBelongsToUser(projectId, req.userId)

    if (!validProject) {
        return res.status(403).json({
            status: 'error',
            message: 'No puedes usar este proyecto.'
        })
    }

    const [result] = await pool.execute(`
        INSERT INTO alyx_chats
            (owner_id, project_id, title, model)
        VALUES
            (?, ?, ?, ?)
    `, [
        req.userId,
        projectId,
        title,
        model
    ])

    const [chats] = await pool.execute(`
        SELECT
            c.id,
            c.owner_id,
            c.project_id,
            c.title,
            c.model,
            c.created_at,
            c.updated_at,
            p.name AS project_name
        FROM alyx_chats c
        LEFT JOIN alyx_projects p ON p.id = c.project_id
        WHERE c.id = ? AND c.owner_id = ?
        LIMIT 1
    `, [result.insertId, req.userId])

    res.status(201).json({
        status: 'success',
        data: chats[0]
    })
}));

// DELETE /alyx/chats/:id
router.delete('/:id', authRequired, asyncRoute(async (req, res) => {
    const chatId = Number(req.params.id)

    if (!Number.isFinite(chatId) || chatId <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Chat inválido.'
        })
    }

    const [existing] = await pool.execute(`
        SELECT id
        FROM alyx_chats
        WHERE id = ? AND owner_id = ?
        LIMIT 1
    `, [chatId, req.userId])

    if (!existing.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Chat no encontrado.'
        })
    }

    await pool.execute(`
        DELETE FROM alyx_chats
        WHERE id = ? AND owner_id = ?
        LIMIT 1
    `, [chatId, req.userId])

    return res.json({
        status: 'success',
        message: 'Chat eliminado correctamente.'
    })
}));

module.exports = router