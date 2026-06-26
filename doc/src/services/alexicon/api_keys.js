import { apiRequest } from '../api'

export function getApiKeys() {
    return apiRequest('/alexicon/api-keys', {
        method: 'GET'
    })
}

export function createApiKey(payload = {}) {
    return apiRequest('/alexicon/api-keys', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}

export function deleteApiKey(keyId) {
    return apiRequest(`/alexicon/api-keys/${keyId}`, {
        method: 'DELETE'
    })
}