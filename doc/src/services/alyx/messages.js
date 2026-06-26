import { apiRequest } from '../api'

const API_URL = import.meta.env.VITE_API_URL

export function getChatMessages(chatId) {
    return apiRequest(`/alyx/messages/chat/${chatId}`, {
        method: 'GET'
    })
}

export function createChatMessage(chatId, payload = {}) {
    return apiRequest(`/alyx/messages/chat/${chatId}`, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}

export function respondToChat(chatId, payload = {}) {
    return apiRequest(`/alyx/messages/chat/${chatId}/respond`, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}

export async function respondToChatStream(chatId, payload = {}, handlers = {}) {
    const token = localStorage.getItem('alexicon_token')

    const response = await fetch(`${API_URL}/alyx/messages/chat/${chatId}/respond-stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    })

    if (!response.ok || !response.body) {
        throw new Error('No se pudo iniciar el stream.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
        const { value, done } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const eventText of events) {
            const line = eventText
                .split('\n')
                .find(item => item.startsWith('data: '))

            if (!line) continue

            const payload = JSON.parse(line.replace('data: ', ''))

            if (payload.type === 'user_message') {
                handlers.onUserMessage?.(payload.message)
            }

            if (payload.type === 'delta') {
                handlers.onDelta?.(payload.text)
            }

            if (payload.type === 'done') {
                handlers.onDone?.(payload.message)
            }

            if (payload.type === 'error') {
                handlers.onError?.(payload.message)
            }
        }
    }
}