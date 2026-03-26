// Handle incoming WhatsApp messages and forward to backend AI
export async function handleMessage(sock, message) {
    if (!message.message) return
    
    // Ignore status updates
    if (message.key.remoteJid === 'status@broadcast') return
    // Ignore messages from ourselves
    if (message.key.fromMe) return

    // Extract text from message
    const messageType = Object.keys(message.message)[0]
    let text = ''
    
    if (messageType === 'conversation') {
        text = message.message.conversation
    } else if (messageType === 'extendedTextMessage') {
        text = message.message.extendedTextMessage?.text || ''
    }

    if (text) {
        console.log(`[Message received] From: ${message.key.remoteJid} -> ${text}`)

        // Trigger script
        if (text === '!ping') {
            await sock.sendMessage(message.key.remoteJid, { text: 'pong!' })
        }
    }
}
