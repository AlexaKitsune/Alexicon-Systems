<template>
    <UTooltipProvider>
        <RouterView :session-user-data="sessionUserData" :user-data="userData" :on-session="onSession"/>
    </UTooltipProvider>
</template>

<script>
import { RouterView } from 'vue-router'
import { me } from '@/services/alexicon/users'

export default {
    name: 'App',

    components: {
        RouterView
    },

    data() {
        return {
            userData: {},
            onSession: false,
            sessionLoading: false
        }
    },

    methods: {
        async loadSession() {
            const token = localStorage.getItem('alexicon_token')

            if (!token) {
                this.userData = {}
                this.onSession = false
                return
            }

            this.sessionLoading = true

            try {
                const result = await me()

                this.userData = result.data || {}
                this.onSession = true

                localStorage.setItem('alexicon_user_id', this.userData.id)
                localStorage.setItem('alexicon_user', JSON.stringify(this.userData))
            } catch (error) {
                console.error(error)

                this.userData = {}
                this.onSession = false

                localStorage.removeItem('alexicon_token')
                localStorage.removeItem('alexicon_user_id')
                localStorage.removeItem('alexicon_user')
            } finally {
                this.sessionLoading = false
            }
        }
    },

    mounted() {
        this.loadSession()
        window.addEventListener(
            'alexicon-login',
            this.loadSession
        )
    },

    beforeUnmount() {
        window.removeEventListener(
            'alexicon-login',
            this.loadSession
        )
    }
}
</script>