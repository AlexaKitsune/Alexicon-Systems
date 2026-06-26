import { apiRequest } from '../api'

export function searchGlobal(params = {}) {
    const query = new URLSearchParams(params).toString()

    return apiRequest(`/yipnet/search/global?${query}`, {
        method: 'GET'
    })
}

export function searchProfile(userId, params = {}) {
    const query = new URLSearchParams(params).toString()

    return apiRequest(`/yipnet/search/profile/${userId}?${query}`, {
        method: 'GET'
    })
}