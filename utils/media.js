const pool = require('./db_conn')

function parseJsonArray(value) {
    if (!value) return []

    if (Array.isArray(value)) {
        return value.filter(item => item !== null && item !== undefined)
    }

    try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed)
            ? parsed.filter(item => item !== null && item !== undefined)
            : []
    } catch {
        return []
    }
}

async function hydrateMedia(media) {
    const cleanIds = parseJsonArray(media)
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && id > 0)

    if (!cleanIds.length) return []

    const placeholders = cleanIds.map(() => '?').join(',')

    const [rows] = await pool.execute(
        `SELECT
            id,
            rel_path,
            mime_type,
            size,
            visibility
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

module.exports = {
    hydrateMedia
}