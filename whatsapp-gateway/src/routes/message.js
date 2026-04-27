import { Router } from 'express'
import { apiKeyMiddleware, sanitizePhoneNumber } from '../utils/security.js'
import { getWASocket } from '../baileys.js'

const router = Router()

// Apply security middleware to all routes in this router
router.use(apiKeyMiddleware)

/**
 * POST /api/messages
 * Sends a WhatsApp message to the given phone number from the API request.
 * Expected Body: { "phone": "08123456789", "message": "Hello from backend!" }
 */
router.post('/', async (req, res) => {
    try {
        const { phone, message } = req.body
        
        // Input Validation
        if (!phone || !message) {
            return res.status(400).json({ error: 'Phone and message fields are required' })
        }
        
        // Sanitization against malicious string patterns / path traversal patterns
        const targetJid = sanitizePhoneNumber(phone)
        if (!targetJid) {
            return res.status(400).json({ error: 'Invalid phone number format' })
        }
        
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
        
        // Attempt to send message
        await sock.sendMessage(targetJid, { text: message })
        
        res.json({ success: true, message: 'Message queued/sent successfully' })
    } catch (error) {
        console.error('[API Error] Failed to send message:', error.message)
        res.status(500).json({ error: 'Internal server error while sending message' })
    }
})

export default router
