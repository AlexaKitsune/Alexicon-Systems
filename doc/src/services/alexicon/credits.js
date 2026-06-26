import { apiRequest } from '../api'

export function getCredits() {
    return apiRequest('/alexicon/credits/me', {
        method: 'GET'
    })
}

export function getCreditTransactions(params = {}) {
    const query = new URLSearchParams(params).toString()

    return apiRequest(`/alexicon/credits/transactions${query ? `?${query}` : ''}`, {
        method: 'GET'
    })
}

export function checkoutCreditsTest(payload = {}) {
    return apiRequest('/alexicon/credits/checkout-test', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
}