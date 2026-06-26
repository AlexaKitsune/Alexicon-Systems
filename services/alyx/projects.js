const express = require('express')
const router = express.Router()

const pool = require('../../utils/db_conn')
const { authRequired } = require('../../utils/auth')
const { asyncRoute } = require('../../utils/route')

function cleanText(value) {
    return String(value || '').trim()
}

// GET /alyx/projects
router.get('/', authRequired, asyncRoute(async (req, res) => {
    const [projects] = await pool.execute(`
        SELECT
            id,
            owner_id,
            name,
            description,
            memory,
            created_at,
            updated_at
        FROM alyx_projects
        WHERE owner_id = ?
        ORDER BY updated_at DESC, id DESC
    `, [req.userId])

    res.json({
        status: 'success',
        data: projects
    })
}))

// POST /alyx/projects
router.post('/', authRequired, asyncRoute(async (req, res) => {
    const name = cleanText(req.body.name)
    const description = cleanText(req.body.description)
    const memory = cleanText(req.body.memory)

    if (!name) {
        return res.status(400).json({
            status: 'error',
            message: 'El nombre del proyecto no puede estar vacío.'
        })
    }

    const [result] = await pool.execute(`
        INSERT INTO alyx_projects
            (owner_id, name, description, memory)
        VALUES
            (?, ?, ?, ?)
    `, [
        req.userId,
        name,
        description || null,
        memory || null
    ])

    const [projects] = await pool.execute(`
        SELECT
            id,
            owner_id,
            name,
            description,
            memory,
            created_at,
            updated_at
        FROM alyx_projects
        WHERE id = ? AND owner_id = ?
        LIMIT 1
    `, [result.insertId, req.userId])

    res.status(201).json({
        status: 'success',
        data: projects[0]
    })
}))

// GET /alyx/projects/:id
router.get('/:id', authRequired, asyncRoute(async (req, res) => {
    const projectId = Number(req.params.id)

    if (!Number.isFinite(projectId) || projectId <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Proyecto inválido.'
        })
    }

    const [projects] = await pool.execute(`
        SELECT
            id,
            owner_id,
            name,
            description,
            memory,
            created_at,
            updated_at
        FROM alyx_projects
        WHERE id = ? AND owner_id = ?
        LIMIT 1
    `, [projectId, req.userId])

    if (!projects.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Proyecto no encontrado.'
        })
    }

    return res.json({
        status: 'success',
        data: projects[0]
    })
}))

// PATCH /alyx/projects/:id
router.patch('/:id', authRequired, asyncRoute(async (req, res) => {
    const projectId = Number(req.params.id)

    if (!Number.isFinite(projectId) || projectId <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Proyecto inválido.'
        })
    }

    const [existing] = await pool.execute(`
        SELECT id
        FROM alyx_projects
        WHERE id = ? AND owner_id = ?
        LIMIT 1
    `, [projectId, req.userId])

    if (!existing.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Proyecto no encontrado.'
        })
    }

    const updates = []
    const values = []

    if (req.body.name !== undefined) {
        const name = cleanText(req.body.name)

        if (!name) {
            return res.status(400).json({
                status: 'error',
                message: 'El nombre del proyecto no puede estar vacío.'
            })
        }

        updates.push('name = ?')
        values.push(name)
    }

    if (req.body.description !== undefined) {
        const description = cleanText(req.body.description)
        updates.push('description = ?')
        values.push(description || null)
    }

    if (req.body.memory !== undefined) {
        const memory = String(req.body.memory || '').trim()
        updates.push('memory = ?')
        values.push(memory || null)
    }

    if (!updates.length) {
        return res.status(400).json({
            status: 'error',
            message: 'No hay campos para actualizar.'
        })
    }

    values.push(projectId, req.userId)

    await pool.execute(`
        UPDATE alyx_projects
        SET ${updates.join(', ')}
        WHERE id = ? AND owner_id = ?
        LIMIT 1
    `, values)

    const [projects] = await pool.execute(`
        SELECT
            id,
            owner_id,
            name,
            description,
            memory,
            created_at,
            updated_at
        FROM alyx_projects
        WHERE id = ? AND owner_id = ?
        LIMIT 1
    `, [projectId, req.userId])

    return res.json({
        status: 'success',
        data: projects[0]
    })
}))

// DELETE /alyx/projects/:id
router.delete('/:id', authRequired, asyncRoute(async (req, res) => {
    const projectId = Number(req.params.id)

    if (!Number.isFinite(projectId) || projectId <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Proyecto inválido.'
        })
    }

    const [existing] = await pool.execute(`
        SELECT id
        FROM alyx_projects
        WHERE id = ? AND owner_id = ?
        LIMIT 1
    `, [projectId, req.userId])

    if (!existing.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Proyecto no encontrado.'
        })
    }

    await pool.execute(`
        DELETE FROM alyx_projects
        WHERE id = ? AND owner_id = ?
        LIMIT 1
    `, [projectId, req.userId])

    return res.json({
        status: 'success',
        message: 'Proyecto eliminado correctamente.'
    })
}))

module.exports = router