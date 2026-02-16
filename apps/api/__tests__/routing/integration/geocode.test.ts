/**
 * Integration tests for geocoding endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createRoutingProvider } from '../../../src/routing/providers/factory';
import { MockCacheService } from '../../../src/routing/cache/MockCacheService';
import { RoutingService } from '../../../src/routing/service';
import { createRoutingRoutes } from '../../../src/routing/routes';
import { env } from '../../../src/config/validateEnv';

describe('POST /api/geocode', () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    fastify = Fastify();
    
    const routingProvider = createRoutingProvider();
    const cacheService = new MockCacheService();
    const routingService = new RoutingService(routingProvider, cacheService, {
      geohashPrecision: env.GEOHASH_PRECISION,
      timeBucketMinutes: env.TIME_BUCKET_MINUTES,
      marginPercent: env.TRAVEL_TIME_MARGIN_PERCENT,
      cacheTtlDays: env.CACHE_TTL_DAYS
    });
    
    await fastify.register(createRoutingRoutes(routingService, routingProvider));
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should return 200 OK with coordinates', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/geocode',
      payload: {
        address: '1 Rue de Rivoli, 75001 Paris, France'
      }
    });

    expect(response.statusCode).toBe(200);
    
    const data = response.json();
    expect(data).toHaveProperty('lat');
    expect(data).toHaveProperty('lng');
    expect(typeof data.lat).toBe('number');
    expect(typeof data.lng).toBe('number');
  });

  it('should return 400 for missing address', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/geocode',
      payload: {
        address: ''
      }
    });

    expect(response.statusCode).toBe(400);
    
    const data = response.json();
    expect(data).toHaveProperty('error');
  });

  it('should return 400 for invalid payload', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/geocode',
      payload: {}
    });

    expect(response.statusCode).toBe(400);
  });

  it('should handle special characters in address', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/geocode',
      payload: {
        address: 'Rue de l\'Église, Montréal'
      }
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data).toHaveProperty('lat');
    expect(data).toHaveProperty('lng');
  });
});
