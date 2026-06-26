import { apiRequest } from '../api'

export function getMyServices() {
    return apiRequest('/alexicon/services/me', {
        method: 'GET'
    })
}