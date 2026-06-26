import { apiRequest } from '../api'

export function recordView(targetType, targetId) {
    return apiRequest(`/yipnet/stats/view/${targetType}/${targetId}`, {
        method: 'POST'
    })
}

export function getStats(targetType, targetId) {
    return apiRequest(`/yipnet/stats/${targetType}/${targetId}`, {
        method: 'GET'
    })
}

export function getProfileContributions(userId) {
    return apiRequest(`/yipnet/stats/profile/${userId}/contributions`, {
        method: 'GET'
    })
}