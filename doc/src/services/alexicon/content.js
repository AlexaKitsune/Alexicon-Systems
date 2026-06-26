import { apiRequest } from '../api'

export function reportContent(targetId, payload) {
    return apiRequest(`/alexicon/content/report/${targetId}`, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}