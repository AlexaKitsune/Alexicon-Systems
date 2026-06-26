import { apiRequest } from '../api'

export function getAlyxUsage() {
    return apiRequest('/alyx/usage/me', {
        method: 'GET'
    })
}