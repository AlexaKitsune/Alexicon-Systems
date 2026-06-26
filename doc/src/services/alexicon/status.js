import { apiRequest } from '../api'

export function getServerStatus() {
    return apiRequest('/alexicon/on', {
        method: 'GET'
    })
}