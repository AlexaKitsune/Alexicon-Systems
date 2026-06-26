import { apiRequest } from '../api'

export function getProjects() {
    return apiRequest('/alyx/projects', {
        method: 'GET'
    })
}

export function createProject(payload = {}) {
    return apiRequest('/alyx/projects', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}

export function getProject(projectId) {
    return apiRequest(`/alyx/projects/${projectId}`, {
        method: 'GET'
    })
}

export function updateProject(projectId, payload = {}) {
    return apiRequest(`/alyx/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
    })
}

export function deleteProject(projectId) {
    return apiRequest(`/alyx/projects/${projectId}`, {
        method: 'DELETE'
    })
}