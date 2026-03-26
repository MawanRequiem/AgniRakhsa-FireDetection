import express from 'express'
import config from './config.js'
import { connectToWhatsApp } from './baileys.js'

const app = express()

// JSON Body parser
app.use(express.json())

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'agniraksha-whatsapp-gateway',
        version: '0.0.1',
    })
})

// Message routes (Secured via API Key middleware in the router)
import messageRoutes from './routes/message.js'
app.use('/api/messages', messageRoutes)

app.listen(config.port, async () => {
    console.log(`🤖 WhatsApp Gateway running on http://localhost:${config.port}`)
    
    try {
        await connectToWhatsApp()
    } catch (error) {
        console.error('Failed to initialize WhatsApp connection:', error)
    }
})
