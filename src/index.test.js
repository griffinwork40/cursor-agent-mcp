import request from 'supertest';
import { app } from './index.js';

describe('Express server endpoints', () => {
  test('GET /health returns ok payload', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
    expect(typeof res.body.uptime).toBe('number');
  });

  test('GET / returns discovery JSON', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'cursor-background-agents',
      endpoints: expect.objectContaining({ mcp: '/mcp', sse: '/sse', health: '/health' }),
    });
  });

  test('unknown route returns 404 JSON', async () => {
    const res = await request(app).get('/nope-not-found');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: expect.objectContaining({ code: 'NOT_FOUND' }),
    });
  });

  test('GET /.well-known/oauth-authorization-server returns discovery', async () => {
    const res = await request(app).get('/.well-known/oauth-authorization-server');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('issuer');
    expect(res.body).toHaveProperty('authorization_endpoint');
    expect(res.body).toHaveProperty('token_endpoint');
  });
});


