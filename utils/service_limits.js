const MB = 1024 ** 2
const GB = 1024 ** 3

const SERVICE_LIMITS = {
    alexicon: {
        0: {
            name: 'Free'
        },
        1: {
            name: 'Plus'
        }
    },

    yipnet: {
        0: {
            name: 'Free',
            maxFileSize: 20 * MB,
            allowedFileGroups: ['image', 'audio', 'video'],
            compressFiles: true,
            premiumProfileFrame: false
        },
        1: {
            name: 'Plus',
            maxFileSize: 100 * MB,
            allowedFileGroups: ['image', 'audio', 'video', 'document', 'archive'],
            compressFiles: false,
            premiumProfileFrame: true
        }
    },

    alyx: {
        0: {
            name: 'Free',
            apiKeys: false,
            unlimitedChat: false,
            credits: true
        },
        1: {
            name: 'Plus',
            apiKeys: true,
            unlimitedChat: true,
            credits: true
        }
    },

    foxdrive: {
        0: {
            name: 'Free',
            storageBytes: 8 * GB,
            contentFilters: false
        },
        1: {
            name: 'Plus',
            storageBytes: 64 * GB,
            contentFilters: true
        },
        2: {
            name: 'Pro',
            storageBytes: 128 * GB,
            contentFilters: true
        },
        3: {
            name: 'Ultra',
            storageBytes: 512 * GB,
            contentFilters: true
        },
        4: {
            name: 'Tera',
            storageBytes: 1024 * GB,
            contentFilters: true
        }
    }
}

function getServiceLimits(service, tier = 0) {
    const serviceLimits = SERVICE_LIMITS[service]

    if (!serviceLimits)
        return null

    return serviceLimits[tier] || serviceLimits[0] || null
}

function getServiceTierName(service, tier = 0) {
    return getServiceLimits(service, tier)?.name || 'Free'
}

function getStorageLabel(bytes = 0) {
    if (bytes >= GB) {
        return `${Math.round(bytes / GB)} GB`
    }

    if (bytes >= MB) {
        return `${Math.round(bytes / MB)} MB`
    }

    return `${bytes} B`
}

module.exports = {
    MB,
    GB,
    SERVICE_LIMITS,
    getServiceLimits,
    getServiceTierName,
    getStorageLabel
}