import { apiRequest } from '../api'

export function getSettings() {
    return apiRequest('/alexicon/settings/me', {
        method: 'GET'
    })
}

export function updateSettings(payload) {
    return apiRequest('/alexicon/settings/me', {
        method: 'PATCH',
        body: JSON.stringify(payload)
    })
}