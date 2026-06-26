import { apiRequest } from '../api'

export function createComment(postId, payload) {
    return apiRequest(`/yipnet/comments/post/${postId}`, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}

export function getComments(postId, limit = 20, offset = 0) {
    return apiRequest(`/yipnet/comments/post/${postId}?limit=${limit}&offset=${offset}`, {
        method: 'GET'
    })
}

export function getComment(id) {
    return apiRequest(`/yipnet/comments/${id}`, {
        method: 'GET'
    })
}

export function updateComment(id, payload) {
    return apiRequest(`/yipnet/comments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
    })
}

export function deleteComment(id) {
    return apiRequest(`/yipnet/comments/${id}`, {
        method: 'DELETE'
    })
}