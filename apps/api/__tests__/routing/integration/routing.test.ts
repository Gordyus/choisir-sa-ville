/**
 * Integration tests for routing endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createRoutingProvider } from '../../../src/routing/providers/factory';
import { MockCacheService } from '../../../src/routing/cache/MockCacheService';
import { RoutingService } from '../../../src/routing/service';
import { createRoutingRoutes } from '../../../src/routing/routes';
import { env } from '../../../src/config/validateEnv';

describe('POST /api/routing/matrix', () => {
  let fastify: FastifyInstance;
  let cacheService: MockCacheService;

  beforeAll(async () => {
    fastify = Fastify();
    
    const routingProvider = createRoutingProvider();
    cacheService = new MockCacheService();
    
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

  it('should return 200 OK with correct matrix format', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/routing/matrix',
      payload: {
        origins: [{ lat: 43.6108, lng: 3.8767 }],
        destinations: [{ lat: 48.8566, lng: 2.3522 }],
        departureTime: '2026-03-15T08:30:00Z',
        mode: 'car'
      }
    });

    expect(response.statusCode).toBe(200);
    
    const data = response.json();
    expect(data).toHaveProperty('durations');
    expect(data).toHaveProperty('distances');
    expect(data).toHaveProperty('fromCache');
    
    expect(data.durations).toHaveLength(1);
    expect(data.durations[0]).toHaveLength(1);
    expect(typeof data.durations[0][0]).toBe('number');
    expect(data.fromCache).toBe(false);
  });

  it('should return cached result on second identical call', async () => {
    cacheService.clear();
    
    const payload = {
      origins: [{ lat: 43.6108, lng: 3.8767 }],
      destinations: [{ lat: 48.8566, lng: 2.3522 }],
      departureTime: '2026-03-15T08:30:00Z',
      mode: 'car'
    };

    // First call
    const response1 = await fastify.inject({
      method: 'POST',
      url: '/api/routing/matrix',
      payload
    });
    
    expect(response1.statusCode).toBe(200);
    const data1 = response1.json();
    expect(data1.fromCache).toBe(false);

    // Second call (should hit cache)
    const start = Date.now();
    const response2 = await fastify.inject({
      method: 'POST',
      url: '/api/routing/matrix',
      payload
    });
    const duration = Date.now() - start;

    expect(response2.statusCode).toBe(200);
    const data2 = response2.json();
    expect(data2.fromCache).toBe(true);
    expect(data2.durations[0][0]).toBe(data1.durations[0][0]);
    expect(duration).toBeLessThan(100); // Cache hit should be fast
  });

  it('should apply error margin to durations', async () => {
    cacheService.clear();
    
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/routing/matrix',
      payload: {
        origins: [{ lat: 43.6108, lng: 3.8767 }],
        destinations: [{ lat: 43.6108, lng: 3.8767 }], // Same point
        departureTime: '2026-03-15T08:30:00Z',
        mode: 'car'
      }
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    
    // Same point should have 0 duration even with margin
    expect(data.durations[0][0]).toBe(0);
  });

  it('should handle multiple origins and destinations', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/routing/matrix',
      payload: {
        origins: [
          { lat: 43.6108, lng: 3.8767 },
          { lat: 45.7640, lng: 4.8357 }
        ],
        destinations: [
          { lat: 48.8566, lng: 2.3522 },
          { lat: 44.8378, lng: -0.5792 }
        ],
        departureTime: '2026-03-15T08:30:00Z',
        mode: 'car'
      }
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    
    expect(data.durations).toHaveLength(2);
    expect(data.durations[0]).toHaveLength(2);
    expect(data.durations[1]).toHaveLength(2);
  });
});
