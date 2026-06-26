import './assets/css/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ui from '@nuxt/ui/vue-plugin'

import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

import App from './App.vue'
import router from './router'

import { i18n } from './i18n'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ui)
app.use(i18n)

if (Capacitor.getPlatform() === 'android') {
    CapacitorApp.addListener('backButton', async () => {
        if (router.currentRoute.value.path !== '/') {
            router.back();
            return;
        }
        await CapacitorApp.exitApp();
    })
}

app.mount('#app')