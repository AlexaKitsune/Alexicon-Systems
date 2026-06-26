import { apiRequest } from '../api'

export function getUserBadges(userId) {
    return apiRequest(`/alexicon/badges/user/${userId}`, {
        method: 'GET'
    })
}

export function awardUserBadge(userId, badgeCode, payload = {}) {
    return apiRequest(`/alexicon/badges/user/${userId}/${badgeCode}`, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}