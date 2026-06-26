function asyncRoute(fn) {
    return async (req, res, next) => {
        try {
            await fn(req, res, next);
        } catch (err) {
            console.error(err);

            return res.status(500).json({
                status: 'error',
                message: 'Error interno del servidor.'
            });
        }
    };
}

module.exports = {
    asyncRoute
};