import { apiRequest } from '../api'

export function me() {
    return apiRequest('/alexicon/users/me', {
        method: 'GET'
    })
}

export function getUser(id) {
    return apiRequest(`/alexicon/users/${id}`, {
        method: 'GET'
    })
}

export function updateProfile(payload) {
    return apiRequest('/alexicon/users/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload)
    })
}

export function updatePassword(payload) {
    return apiRequest('/alexicon/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify(payload)
    })
}

export function uploadAvatar(fileId) {
    return apiRequest('/alexicon/users/me/avatar', {
        method: 'POST',
        body: JSON.stringify({
            file_id: fileId
        })
    })
}

export function uploadCover(fileId) {
    return apiRequest('/alexicon/users/me/cover', {
        method: 'POST',
        body: JSON.stringify({
            file_id: fileId
        })
    })
}

export function getUserByAt(at) {
    return apiRequest(`/alexicon/users/at/${at}`, {
        method: 'GET'
    })
}