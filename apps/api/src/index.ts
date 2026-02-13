/**
 * Fastify Backend Routing Service
 * 
 * Minimal backend API for travel time calculations.
 * Orchestrates external routing API calls with intelligent caching.
 */

import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import 'dotenv/config';
import Fastify from 'fastify';
import { swaggerOptions, swaggerUiOptions } from './config/swagger.js';
import { env, validateEnv } from './config/validateEnv.js';
import { createHealthRoute } from './health/routes.js';
import { MockCacheService } from './routing/cache/MockCacheService.js';
import { createRoutingProvider } from './routing/providers/factory.js';
import { createRoutingRoutes } from './routing/routes.js';
import { RoutingService } from './routing/service.js';

// Validate environment at startup
validateEnv();

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug'
  }
});

// Register CORS (permissive in dev, strict in prod)
await fastify.register(cors, {
  origin: env.NODE_ENV === 'development' ? true : env.CORS_ORIGIN,
});

// Register rate limiting (exclude docs/health routes)
await fastify.register(rateLimit, {
  max: env.RATE_LIMIT_REQUESTS_PER_WINDOW,
  timeWindow: env.RATE_LIMIT_WINDOW_MS,
  skipOnError: true,
  allowList: ['/docs', '/docs/json', '/docs/static/*', '/api/health'],
  errorResponseBuilder: () => {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please slow down your requests.'
    };
  }
});

// Register Swagger documentation
await fastify.register(swagger, swaggerOptions);
await fastify.register(swaggerUi, swaggerUiOptions);

// Initialize services
const routingProvider = createRoutingProvider();
const cacheService = new MockCacheService();

const routingService = new RoutingService(routingProvider, cacheService, {
  geohashPrecision: env.GEOHASH_PRECISION,
  timeBucketMinutes: env.TIME_BUCKET_MINUTES,
  marginPercent: env.TRAVEL_TIME_MARGIN_PERCENT,
  cacheTtlDays: env.CACHE_TTL_DAYS
});

// Register routes
await fastify.register(createRoutingRoutes(routingService, routingProvider));
await fastify.register(createHealthRoute());

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 Routing API server listening on port ${env.PORT}`);
    console.log(`   Provider: ${routingProvider.getName()}`);
    console.log(`   Cache: ${env.ENABLE_CACHE ? 'PostgreSQL' : 'Memory (MockCacheService)'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
