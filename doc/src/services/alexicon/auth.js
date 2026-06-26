import { apiRequest } from '../api'

export function login(payload) {
    return apiRequest('/alexicon/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}

export function register(payload) {
    return apiRequest('/alexicon/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}

export function getSession() {
    return apiRequest('/alexicon/auth/session', {
        method: 'GET'
    })
}

export function logout() {
    return apiRequest('/alexicon/auth/logout', {
        method: 'POST'
    })
}