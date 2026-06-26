const express = require('express');

const pool = require('../../utils/db_conn');
const { authRequired } = require('../../utils/auth');
const { asyncRoute } = require('../../utils/route');

const router = express.Router();

const allowedServices = ['yipnet'];
const allowedTypes = ['post', 'comment', 'message'];

function buildContentRoute(service, type, targetId) {
    const typeRoutes = {
        post: 'posts',
        comment: 'comments',
        message: 'messages'
    };

    return `/${service}/${typeRoutes[type]}/${targetId}`;
}

// POST /alexicon/content/report/:id
router.post('/report/:id', authRequired, asyncRoute(async (req, res) => {
    const targetId = Number(req.params.id);
    const { service, type, message } = req.body;

    if (!Number.isFinite(targetId) || targetId <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    if (!allowedServices.includes(service)) {
        return res.status(400).json({
            status: 'error',
            message: 'Servicio inválido.'
        });
    }

    if (!allowedTypes.includes(type)) {
        return res.status(400).json({
            status: 'error',
            message: 'Tipo de contenido inválido.'
        });
    }

    if (!message || String(message).trim().length < 3) {
        return res.status(400).json({
            status: 'error',
            message: 'El reporte necesita un mensaje.'
        });
    }

    const route = buildContentRoute(service, type, targetId);

    await pool.execute(
        `INSERT INTO reports
         (author_id, service, type, route, message, origin)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            req.userId,
            service,
            type,
            route,
            String(message).trim(),
            req.headers.origin || null
        ]
    );

    return res.status(201).json({
        status: 'success',
        message: 'Reporte enviado correctamente.'
    });
}));

module.exports = router;