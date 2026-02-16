/**
 * Integration tests for health endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createHealthRoute } from '../../../src/health/routes';

describe('GET /api/health', () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    fastify = Fastify();
    await fastify.register(createHealthRoute());
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should return 200 OK', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/health'
    });

    expect(response.statusCode).toBe(200);
  });

  it('should return correct health check format', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/health'
    });

    const data = response.json();
    
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('provider');
    expect(data).toHaveProperty('cache');
    expect(data).toHaveProperty('environment');
    
    expect(data.status).toBe('ok');
    expect(typeof data.version).toBe('string');
    expect(typeof data.uptime).toBe('number');
    expect(typeof data.provider).toBe('string');
    expect(typeof data.cache.enabled).toBe('boolean');
  });

  it('should return uptime greater than 0', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/health'
    });

    const data = response.json();
    expect(data.uptime).toBeGreaterThan(0);
  });

  it('should return correct provider name', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/health'
    });

    const data = response.json();
    expect(['mock', 'tomtom']).toContain(data.provider);
  });
});
