/**
 * Health check endpoint
 * GET /api/health
 * 
 * Returns service status for monitoring.
 */

import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/validateEnv.js';

export const createHealthRoute = (): FastifyPluginAsync => {
  return async (fastify) => {
    fastify.get(
      '/api/health',
      {
        schema: {
          tags: ['Health'],
          description: 'Health check endpoint - returns service status',
          response: {
            200: {
              description: 'Service is healthy',
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ok'] },
                version: { type: 'string' },
                uptime: { type: 'number' },
                provider: { type: 'string' },
                cache: {
                  type: 'object',
                  properties: { enabled: { type: 'boolean' } }
                },
                environment: { type: 'string' }
              }
            }
          }
        }
      },
      async () => {
        return {
          status: 'ok',
          version: '1.0.0',
          uptime: process.uptime(),
          provider: env.ROUTING_PROVIDER,
          cache: {
            enabled: env.ENABLE_CACHE
          },
          environment: env.NODE_ENV
        };
      }
    );
  };
};
