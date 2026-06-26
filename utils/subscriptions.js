const SERVICE_PRICES = {
    alexicon: {
        tier: 1,
        price: 49
    },
    yipnet: {
        tier: 1,
        price: 39
    },
    alyx: {
        tier: 1,
        price: 59
    },
    foxdrive: {
        tier: 1,
        price: 49
    }
}

const CREDIT_PACKS = {
    credits_100: {
        service: 'alyx',
        credits: 100,
        price: 29
    },
    credits_500: {
        service: 'alyx',
        credits: 500,
        price: 99
    },
    credits_1000: {
        service: 'alyx',
        credits: 1000,
        price: 179
    }
}

function normalizeServices(services = []) {
    if (!Array.isArray(services)) return []

    return services
        .map(item => {
            if (typeof item === 'string') {
                return {
                    service: item,
                    tier: 1
                }
            }

            return {
                service: item.service,
                tier: Number(item.tier || 1)
            }
        })
        .filter(item => SERVICE_PRICES[item.service])
}

function normalizeCreditPacks(creditPacks = []) {
    if (!Array.isArray(creditPacks)) return []

    return creditPacks
        .map(item => {
            if (typeof item === 'string') {
                return {
                    id: item,
                    quantity: 1
                }
            }

            return {
                id: item.id,
                quantity: Math.max(Number(item.quantity || 1), 1)
            }
        })
        .filter(item => CREDIT_PACKS[item.id])
}

function calculateSubscriptionTotal(services = [], creditPacks = []) {
    const normalizedServices = normalizeServices(services)
    const normalizedCreditPacks = normalizeCreditPacks(creditPacks)

    const serviceItems = normalizedServices.map(item => {
        const plan = SERVICE_PRICES[item.service]

        return {
            service: item.service,
            tier: item.tier,
            price: plan.price
        }
    })

    const creditItems = normalizedCreditPacks.map(item => {
        const pack = CREDIT_PACKS[item.id]

        return {
            id: item.id,
            service: pack.service,
            credits: pack.credits,
            quantity: item.quantity,
            price: pack.price,
            total: pack.price * item.quantity
        }
    })

    const servicesTotal = serviceItems.reduce(
        (total, item) => total + item.price,
        0
    )

    const creditsTotal = creditItems.reduce(
        (total, item) => total + item.total,
        0
    )

    return {
        services: serviceItems,
        credit_packs: creditItems,
        services_total: servicesTotal,
        credits_total: creditsTotal,
        subtotal: servicesTotal + creditsTotal,
        total: servicesTotal + creditsTotal,
        currency: 'MXN'
    }
}

async function createSubscriptionOrder(db, userId, preview, provider = 'test') {
    const [result] = await db.execute(
        `
        INSERT INTO subscription_orders
            (
                user_id,
                provider,
                status,
                services,
                credit_packs,
                subtotal,
                total,
                currency,
                paid_at
            )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `,
        [
            userId,
            provider,
            'paid',
            JSON.stringify(preview.services || []),
            JSON.stringify(preview.credit_packs || []),
            preview.subtotal || 0,
            preview.total || 0,
            preview.currency || 'MXN'
        ]
    )

    return result.insertId
}

async function syncServices(db, userId, services = []) {
    const selectedServices = services.map(item => item.service)

    if (selectedServices.length) {
        await db.execute(
            `
            UPDATE user_services
            SET active = 0
            WHERE user_id = ?
              AND service NOT IN (${selectedServices.map(() => '?').join(',')})
            `,
            [userId, ...selectedServices]
        )
    } else {
        await db.execute(
            `
            UPDATE user_services
            SET active = 0
            WHERE user_id = ?
            `,
            [userId]
        )
    }

    for (const item of services) {
        await db.execute(
            `
            INSERT INTO user_services
                (user_id, service, tier, active, subscription_date)
            VALUES (?, ?, ?, 1, NOW())
            ON DUPLICATE KEY UPDATE
                tier = VALUES(tier),
                active = 1,
                subscription_date = NOW(),
                expires_at = NULL
            `,
            [
                userId,
                item.service,
                item.tier || 1
            ]
        )
    }
}

async function grantCredits(db, userId, creditPacks = [], description = 'Credit purchase') {
    for (const pack of creditPacks) {
        const amount = Number(pack.credits || 0) * Number(pack.quantity || 1)

        if (!amount) continue

        await db.execute(
            `
            INSERT INTO credits
                (user_id, service, balance)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                balance = balance + VALUES(balance)
            `,
            [
                userId,
                pack.service || 'alyx',
                amount
            ]
        )

        const [rows] = await db.execute(
            `
            SELECT balance
            FROM credits
            WHERE user_id = ? AND service = ?
            LIMIT 1
            `,
            [
                userId,
                pack.service || 'alyx'
            ]
        )

        const balanceAfter = Number(rows[0]?.balance || 0)

        await db.execute(
            `
            INSERT INTO credit_transactions
                (
                    user_id,
                    service,
                    type,
                    amount,
                    balance_after,
                    description,
                    metadata
                )
            VALUES (?, ?, 'purchase', ?, ?, ?, ?)
            `,
            [
                userId,
                pack.service || 'alyx',
                amount,
                balanceAfter,
                description,
                JSON.stringify({
                    pack_id: pack.id,
                    quantity: pack.quantity || 1
                })
            ]
        )
    }
}

async function getUserService(db, userId, service) {
    const [rows] = await db.execute(
        `SELECT service, tier, active, subscription_date, expires_at, metadata
         FROM user_services
         WHERE user_id = ?
           AND service = ?
         LIMIT 1`,
        [userId, service]
    )

    return rows[0] || null
}

async function userHasService(db, userId, service, minTier = 1) {
    const row = await getUserService(db, userId, service)

    if (!row) return false
    if (!Number(row.active)) return false
    if (Number(row.tier || 0) < Number(minTier || 1)) return false

    if (row.expires_at) {
        const expiresAt = new Date(row.expires_at)
        if (expiresAt <= new Date()) return false
    }

    return true
}

async function getUserServiceMap(db, userId) {
    const [rows] = await db.execute(
        `SELECT service, tier, active, subscription_date, expires_at, metadata
         FROM user_services
         WHERE user_id = ?
         ORDER BY service`,
        [userId]
    )

    const map = {}

    rows.forEach(row => {
        map[row.service] = {
            tier: Number(row.tier || 0),
            active: !!row.active,
            subscription_date: row.subscription_date,
            expires_at: row.expires_at,
            metadata: row.metadata
        }
    })

    return map
}

function requireService(service, minTier = 1) {
    return async function (req, res, next) {
        try {
            const ok = await userHasService(
                require('./db_conn'),
                req.userId,
                service,
                minTier
            )

            if (!ok) {
                return res.status(403).json({
                    status: 'error',
                    message: `This feature requires ${service} subscription.`
                })
            }

            next()
        } catch (error) {
            next(error)
        }
    }
}

module.exports = {
    SERVICE_PRICES,
    CREDIT_PACKS,
    normalizeServices,
    normalizeCreditPacks,
    calculateSubscriptionTotal,
    createSubscriptionOrder,
    syncServices,
    grantCredits,

    getUserService,
    userHasService,
    getUserServiceMap,
    requireService
}