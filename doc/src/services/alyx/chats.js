import { apiRequest } from '../api'

export function getChats(params = {}) {
    const query = new URLSearchParams(params).toString()

    return apiRequest(`/alyx/chats${query ? `?${query}` : ''}`, {
        method: 'GET'
    })
}

export function createChat(payload = {}) {
    return apiRequest('/alyx/chats', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}

export function deleteChat(chatId) {
    return apiRequest(`/alyx/chats/${chatId}`, {
        method: 'DELETE'
    })
}