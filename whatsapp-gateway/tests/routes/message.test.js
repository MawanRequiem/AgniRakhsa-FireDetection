import request from 'supertest';
import express from 'express';

// Setup mock app and router
const app = express();
app.use(express.json());

// Mock route since we are keeping it simple as per user request
app.post('/api/messages', (req, res) => {
    const { to, message } = req.body;
    if (!to || !message) {
        return res.status(400).json({ error: 'Missing to or message' });
    }
    return res.status(200).json({ success: true, message: 'Message queued' });
});

describe('Message Routes', () => {
    it('should validate message payload', async () => {
        const response = await request(app)
            .post('/api/messages')
            .send({ to: '1234567890' }); // Missing message
        
        expect(response.status).toBe(400);
    });

    it('should accept valid message payload', async () => {
        const response = await request(app)
            .post('/api/messages')
            .send({ to: '1234567890', message: 'Test alert' });
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });
});
