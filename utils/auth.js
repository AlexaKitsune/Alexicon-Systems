const getIdByToken = require('./get_id_by_token');

function getTokenFromReq(req) {
    const header = req.headers.authorization || '';
    return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function authRequired(req, res, next) {
    const token = getTokenFromReq(req);

    if (!token) return res.status(401).json({
            status: 'error',
            message: 'Token requerido.'
        });

    const userId = await getIdByToken(token);

    if (!userId) return res.status(401).json({
            status: 'error',
            message: 'Sesión inválida o expirada.'
        });

    req.userId = userId;
    next();
}

async function authOptional(req, res, next) {
    const token = getTokenFromReq(req);
    req.userId = null;
    if (token) req.userId = await getIdByToken(token);
    next();
}

module.exports = {
    getTokenFromReq,
    authRequired,
    authOptional
};