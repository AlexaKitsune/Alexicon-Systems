<template>
    <!-- ACCESS MODE -->
    <div
        v-if="variant === 'access'"
        class="min-h-screen flex items-center justify-center bg-[var(--alexicon-bg)] text-[var(--alexicon-text)] px-4"
    >
        <UCard
            class="w-full max-w-md bg-[var(--alexicon-surface)] text-[var(--alexicon-text)] shadow-[0_0_1ch_rgba(0,0,0,0.45)] border-0"
            :ui="{
                root: 'border-0',
                header: 'border-0',
                body: 'border-0',
                footer: 'border-0'
            }"
            variant="ghost"
        >
            <template #header>
                <h1 class="text-xl font-bold">
                {{ mode === 'login' ? `Log in to ${appName}` : 'Create account' }}
                </h1>
                <p class="text-sm opacity-70">
                {{ mode === 'login' ? 'Welcome back to Alexicon.' : `Join Alexicon / ${appName}.` }}
                </p>
            </template>

			<UAlert
				v-if="errorMessage"
				color="error"
				variant="soft"
				icon="i-lucide-triangle-alert"
				:title="errorMessage"
				class="mb-4"
			/>
            <div class="mb-4">
                <div class="server-status" :class="serverOnline ? 'server-online' : 'server-offline'">
                    <span class="server-dot" />
                    <span>{{ serverOnline ? 'Server online' : 'Server offline' }}</span>
                </div>
            </div>

            <UAuthForm
                :fields="fields"
                :loading="loading"
                :submit="{
                    label: mode === 'login' ? 'Log in' : 'Register',
                    color: 'primary',
                }"
                @submit="submit"
                variant="ghost"
            />

            <template #footer>
                <UButton
                    variant="ghost"
                    color="neutral"
                    block
                    class="hover:bg-[#3a3a3a] hover:text-white focus:ring-0"
                    @click="toggleMode"
                >
                    {{ mode === 'login'
                        ? 'Don’t have an account? Register'
                        : 'Already have an account? Log in'
                    }}
                </UButton>
            </template>
        </UCard>
    </div>

    <!-- APP MODE -->
    <div v-else class="min-h-screen bg-white text-black dark:bg-[#222222] dark:text-white">
        <header
            class="fixed top-0 z-50 h-10 w-full bg-[var(--alexicon-surface)] shadow-[0_0_1ch_rgba(0,0,0,0.45)] flex items-center justify-between px-2"
        >
            <div class="flex items-center gap-2">
                <UButton
                    icon="i-lucide-menu"
                    variant="ghost"
                    @click="sidebarOpen = !sidebarOpen"
                    id="main-sidebar-btn"
                />

                <slot name="brand">
                    <RouterLink to="/">Alexicon</RouterLink>
                </slot>

                <div class="server-status" :class="serverOnline ? 'server-online' : 'server-offline'">
                    <span class="server-dot" />
                    <span class="hidden sm:inline">
                        {{ serverOnline ? 'Online' : 'Offline' }}
                    </span>
                </div>
            </div>

            <slot name="search">
                <UInput
                    v-model="headerSearch"
                    icon="i-lucide-search"
                    placeholder="Search"
                    color="neutral"
                    variant="none"
                    class="searchbar hidden md:block w-64"
                    :ui="{
                        base: 'bg-white hover:bg-white focus:bg-white dark:bg-white dark:hover:bg-white dark:focus:bg-white text-black dark:text-black rounded-full'
                    }"
                    @keyup.enter="goToSearch"
                />
            </slot>

            <div class="flex items-center gap-1">
                <slot name="header-actions"></slot>

                <UPopover
                    v-if="showNotifications"
                    v-model:open="notificationsOpen"
                    :ui="{ content: 'w-[min(92vw,420px)] max-h-[70vh] overflow-y-auto bg-[var(--alexicon-surface)] text-[var(--alexicon-text)] border border-white/10' }"
                >
                    <UButton icon="i-lucide-bell" variant="ghost" class="relative">
                        <span
                            v-if="unreadNotifications"
                            class="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-[10px] text-white"
                        >
                            {{ unreadNotifications > 99 ? '99+' : unreadNotifications }}
                        </span>
                    </UButton>

                    <template #content>
                        <div class="p-3">
                            <div class="mb-3 flex items-center justify-between">
                                <h2 class="font-semibold">Notifications</h2>

                                <UButton
                                    to="/notifications"
                                    size="xs"
                                    variant="ghost"
                                    color="neutral"
                                    @click="notificationsOpen = false"
                                >
                                    View all
                                </UButton>
                            </div>

                            <NotificationList
                                :key="notificationRefreshKey"
                                compact
                                :limit="10"
                                @unread-change="unreadNotifications = $event"
                            />
                        </div>
                    </template>
                </UPopover>

                <slot name="after-notifications"></slot>

                <UButton
                    v-if="userData.id"
                    :to="{ name: 'profile', params: { id: userData.id } }"
                    variant="ghost"
                >
                    <UAvatar :src="avatarUrl" />
                </UButton>

                <UButton v-else to="/access" variant="ghost">
                    <UAvatar />
                </UButton>
            </div>
        </header>

        <div class="min-h-[calc(100vh-40px)] pt-10">
            <aside
                class="fixed left-0 top-10 z-40 h-[calc(100vh-40px)] w-64 bg-[var(--alexicon-surface)] border-0 shadow-[0_0_1ch_rgba(0,0,0,0.45)] transition-transform duration-200"
                :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
            >
                <div class="p-4">
                    <slot name="sidebar" :close-sidebar="closeSidebar" />
                </div>

                <div class="absolute bottom-0 left-0 w-full bg-[var(--alexicon-surface)] p-3">
                    <UButton
                        block
                        variant="ghost"
                        icon="i-lucide-log-out"
                        color="neutral"
                        class="justify-start"
                        @click="handleLogout"
                    >
                        Log out
                    </UButton>
                </div>
            </aside>

            <main
                class="h-fit min-w-0 px-[1ch] overflow-x-hidden overflow-y-auto transition-all duration-200"
                :class="sidebarOpen
                    ? 'sm:ml-64 sm:w-[calc(100%-16rem)] w-full'
                    : 'ml-0 w-full'"
            >
                <UContainer>
                    <slot />
                </UContainer>
            </main>
        </div>
    </div>
</template>

<script>
const API_URL = import.meta.env.VITE_API_URL
import { io } from 'socket.io-client'
import { getNotifications } from '@/services/alexicon/notifications'
import NotificationList from '@/components/NotificationList.vue'
import { login, register, logout } from '@/services/alexicon/auth'
import { getServerStatus } from '@/services/alexicon/status'

export default {
    name: 'MainLayout',
    components: {
        NotificationList,
    },
    props: {
        variant: {
            type: String,
            default: 'app'
        },
        userData: {
            type: Object,
            default: () => ({})
        },
        onSession: {
            type: Boolean,
            default: false
        },
        showNotifications: {
            type: Boolean,
            default: true
        }
    },
    data() {
        return {
            sidebarOpen: false,
            headerSearch: '',
            notificationsOpen: false,
            notificationRefreshKey: 0,
            socket: null,
            unreadNotifications: 0,
            mode: 'login',
            loading: false,
            errorMessage: '',
            loginFields: [
                {
                    name: 'email',
                    type: 'email',
                    label: 'Email',
                    placeholder: 'you@example.com',
                    required: true
                },
                {
                    name: 'password',
                    type: 'password',
                    label: 'Password',
                    placeholder: '••••••••',
                    required: true
                }
            ],
            registerFields: [
                {
                    name: 'name',
                    type: 'text',
                    label: 'Name',
                    required: true
                },
                {
                    name: 'surname',
                    type: 'text',
                    label: 'Surname',
                    required: true
                },
                {
                    name: 'nickname',
                    type: 'text',
                    label: 'Nickname',
                    required: true
                },
                {
                    name: 'at_sign',
                    type: 'text',
                    label: '@ username',
                    placeholder: '',
                    required: true
                },
                {
                    name: 'birthday',
                    type: 'date',
                    label: 'Birthday',
                    required: true
                },
                {
                    name: 'gender',
                    type: 'select',
                    label: 'Gender',
                    required: true,
                    items: [
                        { label: 'Woman', value: 'woman' },
                        { label: 'Man', value: 'man' },
                        { label: 'Non-binary', value: 'non_binary' },
                        { label: 'Other', value: 'other' }
                    ]
                },
                {
                    name: 'email',
                    type: 'email',
                    label: 'Email',
                    required: true
                },
                {
                    name: 'password',
                    type: 'password',
                    label: 'Password',
                    required: true
                }
            ],
            serverOnline: null,
            statusInterval: null,
        }
    },
    methods: {
        goToSearch() {
            const q = this.headerSearch.trim()

            this.$router.push({
                name: 'search',
                query: q ? { q } : {}
            })
        },

        connectNotificationsSocket() {
            if (this.socket) return

            const token = localStorage.getItem('alexicon_token')
            if (!token) return

            this.socket = io(API_URL, {
                auth: { token }
            })

            this.socket.on('connect', () => {
                console.log('Socket connected:', this.socket.id)
            })

            this.socket.on('notification', async payload => {
                console.log('New notification:', payload)

                this.notificationRefreshKey++

                await this.refreshUnreadNotifications()

                window.dispatchEvent(
                    new CustomEvent('alexicon-notification', {
                        detail: payload
                    })
                )
            });

            this.socket.on('connect_error', error => {
                console.error('Socket error:', error.message)
            })
        },

        disconnectNotificationsSocket() {
            if (!this.socket) return

            this.socket.off('vote')
            this.socket.off('follow')
            this.socket.off('comment')
            this.socket.off('message')
            this.socket.off('notification')
            this.socket.disconnect()
            this.socket = null
        },

        async refreshUnreadNotifications() {
            try {
                const result = await getNotifications({
                    limit: 1,
                    offset: 0
                })

                this.unreadNotifications =
                    Number(result.data?.unread_count || 0)
            } catch (err) {
                console.error(err)
            }
        },

        closeSidebar() {
            this.sidebarOpen = false;
        },

        toggleMode() {
            this.mode = this.mode === 'login' ? 'register' : 'login'
        },

        async submit(event) {
            this.loading = true
            this.errorMessage = ''

            const data = event.data

            try {
                if (this.mode === 'login') {
                    const result = await login({
                        email: data.email,
                        password: data.password
                    })

                    localStorage.setItem(
                        'alexicon_token',
                        result.data.token
                    )

                    localStorage.setItem(
                        'alexicon_user_id',
                        result.data.user_id
                    )

                    window.dispatchEvent(
                        new Event('alexicon-login')
                    )

                    await this.$nextTick()
                    this.$router.push('/')
                } else {
                    const genderValue =
                        typeof data.gender === 'object'
                            ? data.gender.value
                            : data.gender

                    await register({
                        name: data.name,
                        surname: data.surname,
                        nickname: data.nickname,
                        at_sign: data.at_sign,
                        birthday: data.birthday,
                        gender: genderValue,
                        email: data.email,
                        password: data.password,
                        origin: this.appName.toLowerCase(),
                    })

                    this.mode = 'login'
                }
            } catch (error) {
                this.errorMessage = error.message || 'Ocurrió un error.'
            } finally {
                this.loading = false
            }
        },

        async handleLogout() {
            try {
                await logout()
            } catch (err) {
                console.error(err)
            }
            localStorage.removeItem('alexicon_token')
            localStorage.removeItem('alexicon_user_id')
            this.$router.push('/access')
        },

        async checkServerStatus() {
            try {
                const result = await getServerStatus()

                this.serverOnline = !!(result.data?.active ?? result.active)

                if (this.serverOnline) {
                    this.stopServerStatusInterval()
                }
            } catch (error) {
                console.error('Server status error:', error)
                this.serverOnline = false
            }
        },

        startServerStatusInterval() {
            if (this.statusInterval) return
            if (!this.onSession) return
            if (this.serverOnline) return

            this.statusInterval = setInterval(() => {
                if (this.serverOnline) {
                    this.stopServerStatusInterval()
                    return
                }

                this.checkServerStatus()
            }, 30000)
        },

        stopServerStatusInterval() {
            if (!this.statusInterval) return

            clearInterval(this.statusInterval)
            this.statusInterval = null
        },
    },
    computed: {
        appName() {
            return import.meta.env.VITE_APP_NAME || 'Alexicon'
        },

        avatarUrl() {
			if (!this.userData.profile_pic) return '';
			if (String(this.userData.profile_pic).startsWith('/'))
				return `${API_URL}${this.userData.profile_pic}`;
			return `${API_URL}/alexicon/media/${this.userData.profile_pic}`;
		},

        fields() {
            return this.mode === 'login'
                ? this.loginFields
                : this.registerFields
        },
    },
    mounted() {
        this.connectNotificationsSocket()
        this.refreshUnreadNotifications()

        this.checkServerStatus()

        if (this.onSession) {
            this.startServerStatusInterval()
        }
    },

    beforeUnmount() {
        this.disconnectNotificationsSocket()
        this.stopServerStatusInterval()
    },

    watch: {
        onSession(value) {
            if (value) {
                this.connectNotificationsSocket()
                this.startServerStatusInterval()
            } else {
                this.stopServerStatusInterval()
            }
        }
    },
}
</script>

<style scoped lang="stylus">
.server-status
    display inline-flex
    align-items center
    gap 0.4rem
    font-size 0.75rem
    opacity 0.85
    padding 0.2rem 0.5rem
    border-radius 999px
    background rgba(255, 255, 255, 0.08)

.server-dot
    width 0.45rem
    height 0.45rem
    border-radius 999px

.server-online .server-dot
    background #22c55e

.server-offline .server-dot
    background #ef4444
</style>