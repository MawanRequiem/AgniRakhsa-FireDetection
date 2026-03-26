import config from '../config.js'

/**
 * Middleware to protect API routes with a static API Key.
 * Prevents unauthorized access from outside the backend services.
 */
export const apiKeyMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key']
    
    if (!apiKey || apiKey !== config.apiKey) {
        console.warn(`[SECURITY] Unauthorized access attempt with key: ${apiKey || 'none'}`)
        return res.status(403).json({ error: 'Forbidden: Invalid API Key' })
    }
    
    next()
}

/**
 * Sanitizes phone numbers to prevent malformed jids or injection attempts.
 * Converts to WhatsApp JID format (number@s.whatsapp.net).
 */
export const sanitizePhoneNumber = (phone) => {
    if (!phone || typeof phone !== 'string') return null
    
    // Remove all non-numeric characters except +
    let cleaned = phone.replace(/[^\d+]/g, '')
    
    // Limits length reasonably for international numbers
    if (cleaned.length < 10 || cleaned.length > 20) return null
    
    // Strip leading + 
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.slice(1)
    }

    // Replace leading '0' with standard Indonesian '62' assuming local usage
    // This can be adjusted if multi-country support is needed
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.slice(1)
    }

    return `${cleaned}@s.whatsapp.net`
}
