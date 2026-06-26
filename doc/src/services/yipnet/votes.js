import { apiRequest } from '../api'

export function getVotes(targetType, targetId) {
    return apiRequest(`/yipnet/votes/${targetType}/${targetId}`, {
        method: 'GET'
    })
}

export function putVote(targetType, targetId, voteType) {
    return apiRequest(`/yipnet/votes/${targetType}/${targetId}`, {
        method: 'PUT',
        body: JSON.stringify({
            vote_type: voteType
        })
    })
}

export function deleteVote(targetType, targetId) {
    return apiRequest(`/yipnet/votes/${targetType}/${targetId}`, {
        method: 'DELETE'
    })
}