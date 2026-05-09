import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { handleMessage } from './handlers/message.js'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import fs from 'fs'

// Store global states
let waSocket = null
let latestQr = null
let latestQrImage = null
let waConnectionStatus = 'disconnected' // 'connecting' | 'connected' | 'disconnected' | 'qr'
let consecutiveFailures = 0

export const getWASocket = () => waSocket

export const getWASessionStatus = () => {
    return {
        connected: waConnectionStatus === 'connected',
        status: waConnectionStatus,
        qr: latestQrImage
    }
}

export async function connectToWhatsApp() {
    waConnectionStatus = 'connecting'
    
    // Create auth info directory if not exists
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    
    // Fetch latest WhatsApp WEB version to prevent connection rejection
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log(`🤖 Menggunakan WA v${version.join('.')}, isLatest: ${isLatest}`)

    // Setup logger 
    const logger = pino({ level: 'silent' }) // Diubah ke silent lagi agar tidak spam

    const sock = makeWASocket({
        version,
        auth: state,
        logger,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false
    })

    // Assign globally
    waSocket = sock

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        
        if (qr) {
            latestQr = qr
            waConnectionStatus = 'qr'
            console.log('Scan the QR code below to connect:')
            qrcode.generate(qr, { small: true })
            
            // Generate base64 PNG QR code for dashboard
            try {
                latestQrImage = await QRCode.toDataURL(qr)
            } catch (err) {
                console.error('Failed to generate base64 QR image:', err.message)
            }
        }
        
        if (connection === 'close') {
            waSocket = null
            const statusCode = lastDisconnect.error?.output?.statusCode
            const isLoggedOut = statusCode === DisconnectReason.loggedOut
            console.log('Connection closed due to ', lastDisconnect.error?.message || lastDisconnect.error)
            
            consecutiveFailures++
            
            // Self-healing: clear credentials if logged out or experiencing persistent connection failures
            if (isLoggedOut || consecutiveFailures >= 5) {
                console.log(`🔄 Cleared auth_info_baileys due to: ${isLoggedOut ? 'Logged Out (401)' : 'Persistent Failures (>=5)'}`)
                waConnectionStatus = 'disconnected'
                latestQr = null
                latestQrImage = null
                
                try {
                    if (fs.existsSync('auth_info_baileys')) {
                        fs.rmSync('auth_info_baileys', { recursive: true, force: true })
                    }
                } catch (err) {
                    console.error('Failed to delete auth_info_baileys directory:', err.message)
                }
                
                consecutiveFailures = 0
            } else {
                waConnectionStatus = 'disconnected'
            }
            
            // Reconnect if not explicitly logged out
            const shouldReconnect = !isLoggedOut
            if (shouldReconnect) {
                console.log('Reconnecting in 3 seconds...')
                setTimeout(() => connectToWhatsApp(), 3000)
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp connection opened successfully')
            waSocket = sock
            waConnectionStatus = 'connected'
            latestQr = null
            latestQrImage = null
            consecutiveFailures = 0
        }
    })

    sock.ev.on('messages.upsert', async m => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                try {
                    await handleMessage(sock, msg)
                } catch (error) {
                    console.error('Error handling message:', error)
                }
            }
        }
    })

    return sock
}
