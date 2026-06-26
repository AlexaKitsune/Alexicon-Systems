import { createRouter, createWebHistory } from 'vue-router'
import { getSession } from '@/services/alexicon/auth'

// imports

const routes = [
];

const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach(async (to) => {
    const token = localStorage.getItem('alexicon_token')
    
    if (to.meta.guestOnly && token)
        return { name: 'feed' }
    if (!to.meta.requiresAuth)
        return true
    if (!token)
        return { name: 'access' }

    try {
        await getSession()
        return true
    } catch {
        localStorage.removeItem('alexicon_token')
        localStorage.removeItem('alexicon_user_id')
        return { name: 'access' }
    }
})

export default router