<template>
    <UButton
        variant="ghost"
        color="neutral"
        block
        class="justify-between rounded-full bg-black/20 hover:bg-black/30"
        :to="manageUrl"
        target="_blank"
    >
        <div class="flex items-center gap-2">
            <span
                class="size-3 rounded-full"
                :class="hasSubscription ? 'bg-green-500' : 'bg-gray-500'"
            />

            <span class="text-sm">
                {{ serviceDisplayName }}
                <b>{{ subscriptionLabel }}</b>
            </span>
        </div>

        <span class="text-xs opacity-60">
            Manage subscription →
        </span>
    </UButton>
</template>

<script>
import { getSubscriptions } from '@/services/alexicon/subscriptions'

export default {
    name: 'SubscriptionPill',

    props: {
        serviceName: {
            type: String,
            default: ''
        },

        manageUrl: {
            type: String,
            default: 'https://alexicon.systems/subscriptions'
        }
    },

    data() {
        return {
            subscriptions: {
                services: [],
                map: {}
            }
        }
    },

    computed: {
        serviceDisplayName() {
            return this.serviceName || import.meta.env.VITE_APP_NAME || 'Alexicon'
        },

        serviceKey() {
            return this.serviceDisplayName.toLowerCase()
        },

        currentService() {
            return this.subscriptions.map?.[this.serviceKey] || null
        },

        hasSubscription() {
            return !!this.currentService?.active
        },

        subscriptionLabel() {
            if (!this.hasSubscription) {
                return 'Free'
            }

            const tiers = {
                1: 'Premium',
                2: 'Pro',
                3: 'Ultimate'
            }

            return tiers[Number(this.currentService?.tier)] || 'Premium'
        }
    },

    methods: {
        async loadSubscriptions() {
            try {
                const result = await getSubscriptions()

                this.subscriptions = result.data || {
                    services: [],
                    map: {}
                }
            } catch (error) {
                console.error(error)
            }
        }
    },

    mounted() {
        this.loadSubscriptions()
    }
}
</script>