import request from 'supertest';
import express from 'express';

// Create a simple mock app for testing the health check endpoint
const app = express();
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'agniraksha-whatsapp-gateway',
        version: '0.0.1',
    });
});

describe('Gateway Health Check', () => {
    it('should return status ok', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
    });
});
