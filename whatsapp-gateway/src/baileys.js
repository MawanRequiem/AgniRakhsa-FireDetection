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
 * Known-good version to use as a last resort if WA returns stale versions.
 * As of May 2026, this version is confirmed working.
 */
const SAFETY_VERSION = [2, 3000, 1035194821]

/**
 * Fetch WA Web version with caching.
 * CRITICAL: Stale versions (isLatest: false) cause 405 rejections.
 * If API returns stale and we have no cache, use SAFETY_VERSION.
 */
async function getWAVersion() {
    try {
        const info = await fetchLatestBaileysVersion()
        
        if (info.isLatest) {
            cachedWAVersion = info.version
            console.log(`🤖 WA version OK: v${info.version.join('.')} ✅`)
            return cachedWAVersion
        }
        
        console.warn(`⚠️  Stale WA version from API: v${info.version.join('.')} (isLatest: false)`)
        
        if (cachedWAVersion) {
            console.log(`   → Using cached good version: v${cachedWAVersion.join('.')}`)
            return cachedWAVersion
        }
        
        console.log(`   → Using SAFETY_VERSION fallback: v${SAFETY_VERSION.join('.')}`)
        return SAFETY_VERSION
    } catch (err) {
        if (cachedWAVersion) {
            console.warn(`⚠️  Version fetch error, reusing cached v${cachedWAVersion.join('.')}`)
            return cachedWAVersion
        }
        console.warn(`❌ Version fetch failed: ${err.message}. Using SAFETY_VERSION fallback.`)
        return SAFETY_VERSION
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
        console.log('⏳ No valid WA version yet. Waiting 30s before retry...')
        waConnectionStatus = latestQrImage ? 'qr' : 'disconnected'
        scheduleReconnect(30000, authDir)
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
            // WA server rejected us — almost always a version issue.
            if (isConnectionFailure) {
                connectionFailures++
                console.log(`❌ Connection rejected (attempt ${connectionFailures}). Invalidating version cache.`)
                cachedWAVersion = null // ALWAYS invalidate — version is definitely bad
                
                // After many failures, also clear auth in case it's corrupted
                const shouldClearAuth = connectionFailures >= 8
                if (shouldClearAuth) {
                    console.log('🔄 Clearing credentials after persistent failures...')
                    connectionFailures = 0
                }

                waConnectionStatus = latestQrImage ? 'qr' : 'disconnected'
                // Wait 30s to let the version API CDN refresh
                scheduleReconnect(30000, authDir, shouldClearAuth)
                
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
