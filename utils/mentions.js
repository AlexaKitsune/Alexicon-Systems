function extractMentions(text = '') {
    const matches = String(text).matchAll(/(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,32})/g)

    return [...new Set(
        [...matches].map(match => match[2].toLowerCase())
    )]
}

module.exports = {
    extractMentions
}