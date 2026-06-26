import { apiRequest } from '../api'

export function getNotifications(params = {}) {
    const query = new URLSearchParams(params).toString()

    return apiRequest(`/alexicon/notifications${query ? `?${query}` : ''}`, {
        method: 'GET'
    })
}

export function readNotification(id) {
    return apiRequest(`/alexicon/notifications/${id}/read`, {
        method: 'PATCH'
    })
}

export function readAllNotifications() {
    return apiRequest('/alexicon/notifications/read-all', {
        method: 'PATCH'
    })
}