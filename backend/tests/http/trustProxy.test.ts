import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

describe('trust proxy', () => {
  it('con trust proxy=1 req.ip es el X-Forwarded-For', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.get('/ip', (req, res) => res.json({ ip: req.ip }));
    const res = await request(app).get('/ip').set('X-Forwarded-For', '203.0.113.7');
    expect(res.body.ip).toBe('203.0.113.7');
  });
});
