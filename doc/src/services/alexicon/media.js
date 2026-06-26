const API_URL = import.meta.env.VITE_API_URL

export async function uploadFile(file, { targetPath, visibility }) {
    const token = localStorage.getItem('alexicon_token')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('targetPath', targetPath)
    formData.append('visibility', visibility)

    const response = await fetch(`${API_URL}/alexicon/media`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`
        },
        body: formData
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
        throw data
    }

    return data
}