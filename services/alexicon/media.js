const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mimeTypes = require('mime-types');

const pool = require('../../utils/db_conn');
const { getTokenFromReq, authRequired } = require('../../utils/auth');
const { asyncRoute } = require('../../utils/route');

const router = express.Router();

const ALLOWED_PATHS = ['alexicon', 'yipnet', 'alyx'];
const ALLOWED_EXTENSIONS = [
    // ya tienes
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.mp4', '.mov', '.webm', '.ogg',
    '.pdf', '.docx', '.xls', '.xlsx',
    '.ttf', '.otf', '.woff',
    '.html', '.htm',
    '.psd', '.txt', '.xml', '.csv',
    '.py', '.cpp', '.js', '.css', '.json', '.bat', '.sql',

    // útiles para preview
    '.svg',
    '.md', '.markdown',
    '.ts', '.tsx', '.jsx', '.vue',
    '.java', '.c', '.h', '.hpp', '.cs', '.go', '.rs',
    '.php', '.rb', '.swift', '.kt', '.kts',
    '.sh', '.zsh', '.fish', '.ps1',
    '.yaml', '.yml', '.toml', '.ini', '.env',
    '.log',
    '.rtf',

    // audio
    '.mp3', '.wav', '.m4a', '.aac', '.flac',

    // 3D
    '.glb', '.gltf', '.obj', '.stl'
];

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();

        if (ALLOWED_EXTENSIONS.includes(ext)) return cb(null, true);

        cb(new Error('Tipo de archivo no permitido.'));
    }
}).single('file');

function uploadSingle(req, res) {
    return new Promise((resolve, reject) => {
        upload(req, res, err => {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return reject(new Error(`File too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`));
                }
                return reject(err);
            }
            resolve();
        });
    });
}

function sanitizeTargetPath(targetPath, userId) {
    let safePath = path
        .normalize(targetPath)
        .replace(/^(\.\.(\/|\\|$))+/, '')
        .replace(/^\/+/, '');

    safePath = safePath.replace(/\\/g, '/');

    const pathParts = safePath.split('/').filter(Boolean);
    const service = pathParts[0];

    if (!ALLOWED_PATHS.includes(service)) return null;

    const ownerInPath = pathParts[1];

    if (!ownerInPath || String(ownerInPath) !== String(userId)) {
        const tail = pathParts.slice(2);
        safePath = path.posix.join(service, String(userId), ...tail);
    }

    return safePath;
}

function getUniqueFilePath(storagePath, originalName) {
    const originalExt = path.extname(originalName);
    const originalBase = path.basename(originalName, originalExt);

    let finalName = originalName;
    let finalPath = path.join(storagePath, finalName);

    if (fs.existsSync(finalPath)) {
        const timestamp = Date.now();
        finalName = `${originalBase}_${timestamp}${originalExt}`;
        finalPath = path.join(storagePath, finalName);
    }

    return { finalName, finalPath };
}

function parseAllowedUsers(raw) {
    if (!raw) return [];

    let parsed = raw;

    if (typeof raw === 'string') {
        try {
            parsed = JSON.parse(raw);
        } catch {
            return [];
        }
    }

    if (!Array.isArray(parsed)) return [];

    return [...new Set(
        parsed
            .map(n => parseInt(n, 10))
            .filter(Number.isFinite)
    )];
}

async function getRequestUserId(req) {
    const token = getTokenFromReq(req);
    if (!token) return null;

    const getIdByToken = require('../../utils/get_id_by_token');
    return await getIdByToken(token);
}

// POST /alexicon/media
router.post('/', authRequired, asyncRoute(async (req, res) => {
    try {
        await uploadSingle(req, res);
    } catch (err) {
        return res.status(400).json({
            status: 'error',
            message: err.message
        });
    }

    const file = req.file;
    const targetPath = req.body.targetPath;

    if (!file || !targetPath) {
        return res.status(400).json({
            status: 'error',
            message: 'Falta archivo o ruta.'
        });
    }

    const safePath = sanitizeTargetPath(targetPath, req.userId);

    if (!safePath) {
        return res.status(400).json({
            status: 'error',
            message: 'Ruta de destino no permitida.'
        });
    }

    const storagePath = path.join(__dirname, '../../storage', safePath);
    fs.mkdirSync(storagePath, { recursive: true });

    const { finalName, finalPath } = getUniqueFilePath(storagePath, file.originalname);
    const ext = path.extname(file.originalname).toLowerCase();

    try {
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext) && file.size > 1024 * 1024) {
            await sharp(file.buffer)
                .resize({ width: 1920, withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toFile(finalPath);
        } else {
            fs.writeFileSync(finalPath, file.buffer);
        }

        const relativePath = path.posix.join(safePath, finalName);
        const mimeType = mimeTypes.lookup(finalPath) || 'application/octet-stream';
        const fileSize = fs.statSync(finalPath).size;

        const visRaw = String(req.body.visibility || 'private').toLowerCase();
        const visibility = ['private', 'public', 'custom'].includes(visRaw)
            ? visRaw
            : 'private';

        const allowedUsers = visibility === 'custom'
            ? parseAllowedUsers(req.body.allowedUsers)
            : [];

        const [result] = await pool.execute(
            `INSERT INTO files
             (rel_path, mime_type, size, visibility, allowed_users)
             VALUES (?, ?, ?, ?, ?)`,
            [
                relativePath,
                mimeType,
                fileSize,
                visibility,
                JSON.stringify(allowedUsers)
            ]
        );

        return res.status(201).json({
            status: 'success',
            message: 'Archivo subido correctamente.',
            data: {
                fileId: result.insertId,
                filename: finalName,
                relativePath,
                mediaUrl: `/alexicon/media/${result.insertId}`,
                mime_type: mimeType,
                size: fileSize,
                visibility,
                allowedUsers
            }
        });
    } catch (err) {
        console.error('Error al guardar/registrar archivo:', err);

        if (fs.existsSync(finalPath)) {
            fs.unlinkSync(finalPath);
        }

        return res.status(500).json({
            status: 'error',
            message: 'No se pudo guardar el archivo.'
        });
    }
}));

// GET /alexicon/media/:id
router.get('/:id', asyncRoute(async (req, res) => {
    const fileId = Number(req.params.id);

    if (!Number.isFinite(fileId) || fileId <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'ID inválido.'
        });
    }

    const [rows] = await pool.execute(
        `SELECT *
         FROM files
         WHERE id = ?
         LIMIT 1`,
        [fileId]
    );

    if (!rows.length) {
        return res.status(404).json({
            status: 'error',
            message: 'Archivo no encontrado.'
        });
    }

    const file = rows[0];

    if (file.visibility !== 'public') {
        const userId = await getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({
                status: 'error',
                message: 'No autorizado.'
            });
        }

        if (file.visibility === 'custom') {
            const allowedUsers = JSON.parse(file.allowed_users || '[]');

            if (!allowedUsers.includes(userId)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'No tienes permiso para ver este archivo.'
                });
            }
        }

        if (file.visibility === 'private') {
            const pathParts = file.rel_path.split('/');
            const ownerId = Number(pathParts[1]);

            if (ownerId !== userId) {
                return res.status(403).json({
                    status: 'error',
                    message: 'No tienes permiso para ver este archivo.'
                });
            }
        }
    }

    const absolutePath = path.join(__dirname, '../../storage', file.rel_path);

    if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({
            status: 'error',
            message: 'Archivo físico no encontrado.'
        });
    }

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    return res.sendFile(absolutePath);
}));

module.exports = router;