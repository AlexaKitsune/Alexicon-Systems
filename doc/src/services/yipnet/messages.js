import { apiRequest } from '../api'

export function createConversation(payload) {
    return apiRequest('/yipnet/messages/conversations', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}

export function getConversations(limit = 20, offset = 0) {
    return apiRequest(`/yipnet/messages/conversations?limit=${limit}&offset=${offset}`, {
        method: 'GET'
    })
}

export function getConversationMessages(conversationId, limit = 50, offset = 0) {
    return apiRequest(`/yipnet/messages/conversations/${conversationId}?limit=${limit}&offset=${offset}`, {
        method: 'GET'
    })
}

export function sendConversationMessage(conversationId, payload) {
    return apiRequest(`/yipnet/messages/conversations/${conversationId}`, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}

export function getOrCreateDirectConversation(userId) {
    return apiRequest(`/yipnet/messages/direct/${userId}`, {
        method: 'POST'
    })
}

export function updateConversation(conversationId, payload) {
    return apiRequest(`/yipnet/messages/conversations/${conversationId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
    })
}

export function leaveConversation(conversationId) {
    return apiRequest(`/yipnet/messages/conversations/${conversationId}/leave`, {
        method: 'DELETE'
    })
}

export function addConversationParticipants(conversationId, participants) {
    return apiRequest(`/yipnet/messages/conversations/${conversationId}/participants`, {
        method: 'POST',
        body: JSON.stringify({ participants })
    })
}

export function removeConversationParticipant(conversationId, userId) {
    return apiRequest(`/yipnet/messages/conversations/${conversationId}/participants/${userId}`, {
        method: 'DELETE'
    })
}

export function updateConversationParticipantRole(conversationId, userId, role) {
    return apiRequest(`/yipnet/messages/conversations/${conversationId}/participants/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
    })
}