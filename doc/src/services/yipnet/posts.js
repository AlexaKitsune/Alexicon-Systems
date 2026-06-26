import { apiRequest } from '../api'

export function createPost(payload) {
    return apiRequest('/yipnet/posts', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}

export function getFeed() {
    return apiRequest('/yipnet/posts/feed', {
        method: 'GET'
    })
}

export function getUserPosts(userId) {
    return apiRequest(`/yipnet/posts/user/${userId}`, {
        method: 'GET'
    })
}

export function getPost(id) {
    return apiRequest(`/yipnet/posts/${id}`, {
        method: 'GET'
    })
}

export function deletePost(id) {
    return apiRequest(`/yipnet/posts/${id}`, {
        method: 'DELETE'
    })
}

export function updatePost(id, payload) {
    return apiRequest(`/yipnet/posts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
    })
}