const jwt = require('jsonwebtoken');
const pool = require('./db_conn');

let ioInstance = null;

async function verifySocketToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY, {
            algorithms: ['HS256']
        });

        const userId = Number(decoded.sub);
        const jti = decoded.jti;

        if (!Number.isFinite(userId) || !jti) return null;

        const [rows] = await pool.execute(
            `SELECT 1
             FROM active_tokens
             WHERE jti = ?
               AND user_id = ?
               AND expires_at > NOW()
             LIMIT 1`,
            [jti, userId]
        );

        return rows.length ? userId : null;
    } catch {
        return null;
    }
}

function initSocket(server) {
    const { Server } = require('socket.io');

    const io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error('Token requerido'));
        }

        const userId = await verifySocketToken(token);

        if (!userId) {
            return next(new Error('Token inválido o expirado'));
        }

        socket.userId = userId;
        next();
    });

    io.on('connection', (socket) => {
        console.log('Socket conectado:', socket.id, 'user:', socket.userId);

        socket.join(`user_${socket.userId}`);

        socket.on('disconnect', () => {
            console.log('Socket desconectado:', socket.id, 'user:', socket.userId);
        });
    });

    ioInstance = io;
}

function emitToUser(userId, event, data) {
    if (!ioInstance) return false;

    ioInstance.to(`user_${userId}`).emit(event, data);
    return true;
}

async function emitNotification(userId, event, service = 'alexicon', data = {}, dbSave = true) {
    try {
        const payload = {
            id: null,
            seen: false,
            event,
            content: data ?? {},
            service,
            notif_date: new Date().toISOString()
        };

        if (!dbSave) {
            emitToUser(userId, event, payload);
            emitToUser(userId, 'notification', payload);
            return { ok: true, notifId: null, payload };
        }

        const [result] = await pool.execute(
            `INSERT INTO notifications (owner_id, event, content, service)
             VALUES (?, ?, ?, ?)`,
            [userId, event, JSON.stringify(payload.content), service]
        );

        payload.id = result.insertId;

        emitToUser(userId, event, payload);
        emitToUser(userId, 'notification', payload);

        return { ok: true, notifId: payload.id, payload };
    } catch (err) {
        console.error('emitNotification error:', err);

        return {
            ok: false,
            error: err.message
        };
    }
}

module.exports = {
    initSocket,
    emitNotification,
    emitToUser
};