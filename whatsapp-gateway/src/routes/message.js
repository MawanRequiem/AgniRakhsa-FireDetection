import { Router } from 'express'

const router = Router()

// POST /api/messages/send — Backend calls this to send a WhatsApp message
router.post('/send', async (req, res) => {
    const { phone, message } = req.body

    if (!phone || !message) {
        return res.status(400).json({ error: 'phone and message are required' })
    }

    // TODO: Use Baileys sock to send message
    console.log(`📤 Send to ${phone}: ${message}`)

    res.json({ success: true, phone, message })
})

export default router
