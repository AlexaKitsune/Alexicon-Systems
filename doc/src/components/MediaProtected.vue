<template>
    <img
        v-if="asyncSrc"
        :src="asyncSrc"
        :alt="alt"
        :class="imgClass"
    >
</template>

<script>
const API_URL = import.meta.env.VITE_API_URL

export default {
    name: 'MediaProtected',

    props: {
        mediaId: {
            type: [Number, String],
            required: true
        },
        alt: {
            type: String,
            default: ''
        },
        imgClass: {
            type: String,
            default: 'max-h-80 max-w-full rounded-lg object-contain'
        }
    },

    data() {
        return {
            asyncSrc: '',
            retryTimer: null
        }
    },

    computed: {
        isValidId() {
            const id = Number(this.mediaId)
            return Number.isFinite(id) && id > 0
        }
    },

    watch: {
        mediaId: {
            immediate: true,
            handler() {
                this.clearBlob()

                if (this.isValidId)
                    this.fetchWithRetry(Number(this.mediaId))
            }
        }
    },

    methods: {
        clearBlob() {
            if (this.asyncSrc && this.asyncSrc.startsWith('blob:')) {
                URL.revokeObjectURL(this.asyncSrc)
            }

            this.asyncSrc = ''
        },

        scheduleRetry(fn, attempt) {
            const delay = Math.min(300 * attempt, 1500)
            this.retryTimer = setTimeout(fn, delay)
        },

        async fetchWithRetry(id, attempt = 1, maxAttempts = 5) {
            const ok = await this.loadOnce(id)

            if (ok)
                return

            if (attempt < maxAttempts) {
                this.scheduleRetry(
                    () => this.fetchWithRetry(id, attempt + 1, maxAttempts),
                    attempt
                )
            }
        },

        async loadOnce(id) {
            const url = `${API_URL}/alexicon/media/${id}`

            try {
                const publicResponse = await fetch(url, {
                    cache: 'no-store'
                })

                if (publicResponse.ok) {
                    this.asyncSrc = url
                    return true
                }

                if (publicResponse.status !== 401 && publicResponse.status !== 403) {
                    return false
                }
            } catch {
                // retry below
            }

            const token = localStorage.getItem('alexicon_token')

            if (!token)
                return false

            try {
                const privateResponse = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    cache: 'no-store'
                })

                if (!privateResponse.ok)
                    return false

                const blob = await privateResponse.blob()
                const blobUrl = URL.createObjectURL(blob)

                this.clearBlob()
                this.asyncSrc = blobUrl

                return true
            } catch {
                return false
            }
        }
    },

    beforeUnmount() {
        if (this.retryTimer)
            clearTimeout(this.retryTimer)

        this.clearBlob()
    }
}
</script>