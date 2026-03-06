import express from 'express'
import config from './config.js'

const app = express()
app.use(express.json())

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'agniraksha-whatsapp-gateway',
        version: '0.0.1',
    })
})

// TODO: Import routes
// import messageRoutes from './routes/message.js'
// app.use('/api/messages', messageRoutes)

app.listen(config.port, () => {
    console.log(`🤖 WhatsApp Gateway running on http://localhost:${config.port}`)
    // TODO: Initialize Baileys connection here
})
