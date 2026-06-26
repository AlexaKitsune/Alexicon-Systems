const API_URL = import.meta.env.VITE_API_URL

export async function apiRequest(path, options = {}) {
    const token = localStorage.getItem('alexicon_token')

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
        throw data
    }

    return data
}