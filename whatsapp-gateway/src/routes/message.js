import { Router } from 'express'
import { apiKeyMiddleware, sanitizePhoneNumber } from '../utils/security.js'
import { getWASocket, getWASessionStatus } from '../baileys.js'

const router = Router()

// Apply security middleware to all routes in this router
router.use(apiKeyMiddleware)

// Per-contact rate limiting: key = "${phone}:${roomId}", value = timestamp
// Prevents flooding individual contacts with repeated alerts for the same room
const waCooldowns = new Map()
const WA_CONTACT_COOLDOWN_MS = 10 * 60 * 1000 // 10 minutes

/**
 * GET /api/messages/status
 * Exposes the connection status and any pending QR code image to authenticated backend requests.
 */
router.get('/status', (req, res) => {
    try {
        const status = getWASessionStatus()
        res.json(status)
    } catch (error) {
        console.error('[API Error] Failed to get session status:', error.message)
        res.status(500).json({ error: 'Internal server error while fetching connection status' })
    }
})

/**
 * POST /api/messages
 * Sends a WhatsApp message to the given phone number.
 * 
 * Supports two modes:
 * - Text only: { "phone": "08123456789", "message": "Hello!" }
 * - Image + caption: { "phone": "08123456789", "message": "Caption text", "imageUrl": "https://..." }
 */
router.post('/', async (req, res) => {
    try {
        const { phone, message, imageUrl } = req.body
        
        // Input Validation
        if (!phone || !message) {
            return res.status(400).json({ error: 'Phone and message fields are required' })
        }
        
        // Sanitization against malicious string patterns / path traversal patterns
        const targetJid = sanitizePhoneNumber(phone)
        if (!targetJid) {
            return res.status(400).json({ error: 'Invalid phone number format' })
        }

        // Per-contact rate limiting: prevent flooding the same contact
        // about the same room within the cooldown window
        const roomId = req.body.roomId || '__global__'
        const waKey = `${phone}:${roomId}`
        const now = Date.now()
        const lastSent = waCooldowns.get(waKey)
        if (lastSent && (now - lastSent) < WA_CONTACT_COOLDOWN_MS) {
            const remaining = Math.ceil((WA_CONTACT_COOLDOWN_MS - (now - lastSent)) / 1000)
            console.log(`[Rate Limit] Suppressed duplicate WA for ${waKey} (${remaining}s remaining)`)
            return res.status(429).json({
                error: 'Rate limited',
                retryAfterSeconds: remaining,
            })
        }
        waCooldowns.set(waKey, now)
        
        // Ensure WA connection is ready and authenticated
        const sock = getWASocket()
        if (!sock || !sock.user) {
            return res.status(503).json({ 
                error: 'Service Unavailable: WhatsApp is not authenticated. Please scan the QR code first.' 
            })
        }
        
        // Cek apakah nomor WA valid / terdaftar di server WA untuk mencegah Baileys Crash
        let results;
        try {
            results = await sock.onWhatsApp(targetJid)
        } catch (err) {
            console.error(`[API Error] onWhatsApp check failed for ${targetJid}:`, err.message)
            return res.status(502).json({ error: 'WhatsApp server communication error' })
        }

        if (!results || results.length === 0 || !results[0].exists) {
            console.error(`[API Error] Target ${targetJid} not registered on WhatsApp. Skipping.`)
            return res.status(404).json({ error: 'Phone number is not registered on WhatsApp' })
        }
        
        const result = results[0]
        
        // Send message — image or text
        if (imageUrl) {
            // Image message with caption
            console.log(`📸 Sending image message to ${targetJid} (url: ${imageUrl.substring(0, 60)}...)`)
            try {
                await sock.sendMessage(targetJid, {
                    image: { url: imageUrl },
                    caption: message,
                })
                console.log(`✅ Image message sent to ${targetJid}`)
            } catch (imgErr) {
                // Fallback: if image download fails, send as text with link
                console.warn(`⚠️ Image send failed for ${targetJid}, falling back to text: ${imgErr.message}`)
                const fallbackMsg = `${message}\n\n📸 Lihat gambar: ${imageUrl}`
                await sock.sendMessage(targetJid, { text: fallbackMsg })
                console.log(`✅ Fallback text message sent to ${targetJid}`)
            }
        } else {
            // Plain text message
            await sock.sendMessage(targetJid, { text: message })
        }
        
        res.json({ success: true, message: 'Message queued/sent successfully' })
    } catch (error) {
        console.error('[API Error] Failed to send message:', error.message)
        res.status(500).json({ error: 'Internal server error while sending message' })
    }
})

export default router
