import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { handleMessage } from './handlers/message.js'
import pino from 'pino'
import qrcode from 'qrcode-terminal'

// Store global socket connection to be accessed by API routes
let waSocket = null

export const getWASocket = () => waSocket

export async function connectToWhatsApp() {
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

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update
        
        if (qr) {
            console.log('Scan the QR code below to connect:')
            qrcode.generate(qr, { small: true })
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('Connection closed due to ', lastDisconnect.error?.message || lastDisconnect.error)
            
            // Reconnect if not logged out
            if (shouldReconnect) {
                console.log('Reconnecting...')
                connectToWhatsApp()
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp connection opened successfully')
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
