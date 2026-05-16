import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { handleMessage } from './handlers/message.js'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

// ─── Global State ──────────────────────────────────────────────
let waSocket = null
let latestQrImage = null
let waConnectionStatus = 'disconnected' // 'connecting' | 'connected' | 'disconnected' | 'qr'

// ─── Version Cache ─────────────────────────────────────────────
// Cache the successfully fetched WA version so we never fall back to a broken hardcoded one.
let cachedWAVersion = null

// ─── Reconnect Logic ───────────────────────────────────────────
let connectionFailures = 0          // Only real 405-type failures
let reconnectDelay = 3000
const MAX_RECONNECT_DELAY = 120000  // Cap at 2 min
let reconnectTimer = null           // Prevent duplicate timers

// ─── Public Accessors ──────────────────────────────────────────
export const getWASocket = () => waSocket

export const getWASessionStatus = () => ({
    connected: waConnectionStatus === 'connected',
    status: waConnectionStatus,
    qr: latestQrImage
})

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Clear auth contents inside the Docker volume mount (can't rm the dir itself → EBUSY).
 */
function clearAuthDirectory(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) return
        const entries = fs.readdirSync(dirPath)
        for (const entry of entries) {
            fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true })
        }
        console.log(`🗑️  Cleared ${entries.length} auth items`)
    } catch (err) {
        console.error(`Failed to clear auth directory: ${err.message}`)
    }
}

/**
 * Fetch WA Web version with caching. Only hits the network when cache is empty.
 * On failure, returns the cached version or null.
 */
async function getWAVersion() {
    try {
        const info = await fetchLatestBaileysVersion()
        cachedWAVersion = info.version
        console.log(`🤖 WA version fetched: v${info.version.join('.')} (latest: ${info.isLatest})`)
        return cachedWAVersion
    } catch (err) {
        if (cachedWAVersion) {
            console.warn(`⚠️  Version fetch failed, reusing cached v${cachedWAVersion.join('.')}`)
            return cachedWAVersion
        }
        console.error(`❌ Version fetch failed and no cache available. Retrying in 10s...`)
        return null // Caller should delay and retry
    }
}

function scheduleReconnect(delay, authDir, shouldClearAuth = false) {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    
    if (shouldClearAuth) {
        clearAuthDirectory(authDir)
    }
    
    console.log(`⏳ Reconnecting in ${(delay / 1000).toFixed(0)}s...`)
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connectToWhatsApp()
    }, delay)
}

// ─── Main Connection ───────────────────────────────────────────

export async function connectToWhatsApp() {
    waConnectionStatus = 'connecting'
    const authDir = 'auth_info_baileys'

    // Ensure auth dir exists
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true })
    }

    // Get WA version (cached or fresh). If totally unavailable, wait and retry.
    const version = await getWAVersion()
    if (!version) {
        waConnectionStatus = latestQrImage ? 'qr' : 'disconnected'
        scheduleReconnect(10000, authDir)
        return
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir)

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false,
        connectTimeoutMs: 30000,
        qrTimeout: 60000,       // Give user 60s per QR cycle
    })

    waSocket = sock

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        // ── QR Received ────────────────────────────────────────
        if (qr) {
            waConnectionStatus = 'qr'
            console.log('\n📱 New QR code generated:')
            qrcode.generate(qr, { small: true })

            try {
                latestQrImage = await QRCode.toDataURL(qr, {
                    width: 300, margin: 2,
                    color: { dark: '#000000', light: '#ffffff' }
                })
                console.log(`✅ QR image ready for dashboard (${latestQrImage.length} chars)`)
            } catch (err) {
                console.error('Failed to generate QR image:', err.message)
            }
        }

        // ── Connection Closed ──────────────────────────────────
        if (connection === 'close') {
            waSocket = null
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const errorMsg = lastDisconnect?.error?.message || String(lastDisconnect?.error || 'Unknown')
            const isLoggedOut = statusCode === DisconnectReason.loggedOut
            const isQrTimeout = statusCode === DisconnectReason.timedOut || errorMsg.includes('QR refs')
            const isStreamError = statusCode === 515
            const isConnectionFailure = statusCode === 405

            console.log(`\n🔌 Connection closed [${statusCode}]: ${errorMsg}`)

            // ── CASE 1: Logged out explicitly ──────────────────
            if (isLoggedOut) {
                console.log('🔒 Logged out. Clearing all credentials...')
                latestQrImage = null
                waConnectionStatus = 'disconnected'
                connectionFailures = 0
                reconnectDelay = 3000
                scheduleReconnect(5000, authDir, true)
                return
            }

            // ── CASE 2: QR timed out (not scanned) ─────────────
            // This is NORMAL. Just reconnect quickly to show a new QR.
            // Do NOT increment failure counter. Do NOT clear credentials.
            if (isQrTimeout) {
                console.log('⏰ QR expired (not scanned). Generating new QR...')
                // Keep latestQrImage visible until new one replaces it
                waConnectionStatus = 'qr'
                scheduleReconnect(2000, authDir, true) // Clear partial auth from unscanned QR
                return
            }

            // ── CASE 3: Stream error (515) after QR was shown ──
            // Often happens during/after scan attempt. Keep credentials.
            if (isStreamError) {
                console.log('⚡ Stream error. Retrying with existing credentials...')
                waConnectionStatus = latestQrImage ? 'qr' : 'disconnected'
                scheduleReconnect(3000, authDir) // Do NOT clear auth — scan may have partially worked
                return
            }

            // ── CASE 4: Connection failure (405) ───────────────
            // The WA server rejected us. Usually version or network issue.
            if (isConnectionFailure) {
                connectionFailures++
                console.log(`❌ Connection rejected by WA server (attempt ${connectionFailures})`)
                
                // After several failures, force re-fetch version
                if (connectionFailures >= 3) {
                    console.log('🔄 Clearing version cache to force fresh fetch...')
                    cachedWAVersion = null // Force re-fetch on next connect
                }

                // After many failures, also clear auth in case it's corrupted
                const shouldClearAuth = connectionFailures >= 6
                if (shouldClearAuth) {
                    console.log('🔄 Clearing credentials after persistent failures...')
                    connectionFailures = 0
                }

                waConnectionStatus = latestQrImage ? 'qr' : 'disconnected'
                scheduleReconnect(reconnectDelay, authDir, shouldClearAuth)
                
                // Exponential backoff: 3s → 6s → 12s → ... → max 120s
                reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
                return
            }

            // ── CASE 5: Any other disconnect ───────────────────
            console.log('⚠️  Unexpected disconnect. Retrying...')
            waConnectionStatus = latestQrImage ? 'qr' : 'disconnected'
            scheduleReconnect(5000, authDir)
        }

        // ── Connection Opened ──────────────────────────────────
        if (connection === 'open') {
            console.log('✅ WhatsApp connected successfully!')
            waSocket = sock
            waConnectionStatus = 'connected'
            latestQrImage = null
            connectionFailures = 0
            reconnectDelay = 3000
        }
    })

    sock.ev.on('messages.upsert', async (m) => {
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
