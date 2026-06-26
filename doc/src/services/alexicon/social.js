import { apiRequest } from '../api'

export function followUser(id) {
    return apiRequest(`/alexicon/social/${id}/follow`, {
        method: 'POST'
    })
}

export function unfollowUser(id) {
    return apiRequest(`/alexicon/social/${id}/follow`, {
        method: 'DELETE'
    })
}

export function blockUser(id) {
    return apiRequest(`/alexicon/social/${id}/block`, {
        method: 'POST'
    })
}

export function unblockUser(id) {
    return apiRequest(`/alexicon/social/${id}/block`, {
        method: 'DELETE'
    })
}

export function getMentionSuggestions(q) {
    const params = new URLSearchParams({
        q: q || ''
    })
    return apiRequest(`/alexicon/social/mentions?${params.toString()}`)
}

export function getBlockedUsers() {
    return apiRequest('/alexicon/social/blocked', {
        method: 'GET'
    })
}