import { createI18n } from 'vue-i18n'

const messages = {
    // messages in languages
    en: {},
    es: {},
    ja: {},
}

const savedUser = JSON.parse(localStorage.getItem('alexicon_user') || '{}')

export const i18n = createI18n({
    legacy: false,
    locale: savedUser.language || 'en',
    fallbackLocale: 'en',
    messages
})