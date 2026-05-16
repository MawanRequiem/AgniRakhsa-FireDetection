import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { handleMessage } from './handlers/message.js'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

// Store global states
let waSocket = null
let latestQr = null
let latestQrImage = null
let waConnectionStatus = 'disconnected' // 'connecting' | 'connected' | 'disconnected' | 'qr'
let consecutiveFailures = 0
let reconnectDelay = 3000 // Start at 3s, increases with backoff
const MAX_RECONNECT_DELAY = 60000 // Cap at 60s

export const getWASocket = () => waSocket

export const getWASessionStatus = () => {
    return {
        connected: waConnectionStatus === 'connected',
        status: waConnectionStatus,
        qr: latestQrImage
    }
}

/**
 * Clear auth credentials safely inside a Docker volume mount.
 * We cannot rmSync the root mount directory itself (EBUSY),
 * so we delete all files/subdirectories INSIDE it instead.
 */
function clearAuthDirectory(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) return
        const entries = fs.readdirSync(dirPath)
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry)
            fs.rmSync(fullPath, { recursive: true, force: true })
        }
        console.log(`🗑️  Cleared ${entries.length} items inside ${dirPath}`)
    } catch (err) {
        console.error(`Failed to clear auth directory contents: ${err.message}`)
    }
}

export async function connectToWhatsApp() {
    waConnectionStatus = 'connecting'
    
    const authDir = 'auth_info_baileys'

    // Ensure directory exists (Docker volume may create it as empty mount)
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    
    // Fetch latest WhatsApp WEB version to prevent connection rejection
    let version
    try {
        const versionInfo = await fetchLatestBaileysVersion()
        version = versionInfo.version
        console.log(`🤖 Menggunakan WA v${version.join('.')}, isLatest: ${versionInfo.isLatest}`)
    } catch (err) {
        // Fallback to a known working version if fetch fails (network issues in Docker)
        version = [2, 3000, 1015901307]
        console.warn(`⚠️  Failed to fetch latest WA version, using fallback: ${version.join('.')}`)
    }

    // Setup logger 
    const logger = pino({ level: 'silent' })

    const sock = makeWASocket({
        version,
        auth: state,
        logger,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false,
        connectTimeoutMs: 30000,
        qrTimeout: 40000,
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
                latestQrImage = await QRCode.toDataURL(qr, {
                    width: 300,
                    margin: 2,
                    color: { dark: '#000000', light: '#ffffff' }
                })
            } catch (err) {
                console.error('Failed to generate base64 QR image:', err.message)
            }
        }
        
        if (connection === 'close') {
            waSocket = null
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const errorMessage = lastDisconnect?.error?.message || lastDisconnect?.error || 'Unknown'
            const isLoggedOut = statusCode === DisconnectReason.loggedOut
            const isQrExpired = statusCode === DisconnectReason.timedOut || 
                                String(errorMessage).includes('QR refs')
            
            console.log(`Connection closed (code: ${statusCode}): ${errorMessage}`)
            
            consecutiveFailures++

            if (isLoggedOut) {
                // Logged out explicitly — clear and stop
                console.log('🔒 Logged out by user. Clearing credentials...')
                waConnectionStatus = 'disconnected'
                latestQr = null
                latestQrImage = null
                clearAuthDirectory(authDir)
                consecutiveFailures = 0
                reconnectDelay = 3000
                // Still reconnect to show a fresh QR code
                console.log('Reconnecting in 5 seconds to generate new QR...')
                setTimeout(() => connectToWhatsApp(), 5000)
                return
            }
            
            if (isQrExpired) {
                // QR code expired without being scanned — clear stale partial auth and retry
                console.log('⏰ QR code expired. Clearing partial session and retrying...')
                clearAuthDirectory(authDir)
                consecutiveFailures = 0
                reconnectDelay = 3000
                waConnectionStatus = 'disconnected'
                latestQr = null
                latestQrImage = null
                console.log('Reconnecting in 5 seconds to generate new QR...')
                setTimeout(() => connectToWhatsApp(), 5000)
                return
            }

            // Generic connection failure — use exponential backoff
            if (consecutiveFailures >= 5) {
                console.log(`🔄 Persistent failures (${consecutiveFailures}). Clearing credentials and resetting...`)
                clearAuthDirectory(authDir)
                consecutiveFailures = 0
                reconnectDelay = 3000
                latestQr = null
                latestQrImage = null
            }

            waConnectionStatus = 'disconnected'
            console.log(`Reconnecting in ${reconnectDelay / 1000} seconds...`)
            setTimeout(() => connectToWhatsApp(), reconnectDelay)
            
            // Exponential backoff: 3s → 6s → 12s → 24s → 48s → cap at 60s
            reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
            
        } else if (connection === 'open') {
            console.log('✅ WhatsApp connection opened successfully!')
            waSocket = sock
            waConnectionStatus = 'connected'
            latestQr = null
            latestQrImage = null
            consecutiveFailures = 0
            reconnectDelay = 3000 // Reset backoff on successful connection
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
