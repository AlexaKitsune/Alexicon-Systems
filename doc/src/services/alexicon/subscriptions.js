import { apiRequest } from '../api'

export function getSubscriptions() {
    return apiRequest('/alexicon/subscriptions/me', {
        method: 'GET'
    })
}

export function previewSubscription(payload = {}) {
    return apiRequest('/alexicon/subscriptions/preview', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}

export function checkoutSubscriptionTest(payload = {}) {
    return apiRequest('/alexicon/subscriptions/checkout-test', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}