/**
 * Routing endpoints
 * POST /api/routing/matrix - Calculate travel time matrix
 * POST /api/geocode - Convert address to GPS coordinates
 */

import type { FastifyPluginAsync } from 'fastify';
import type { RoutingService } from './service.js';
import type { MatrixParams, RoutingProvider } from './providers/interface.js';
import { QuotaExceededError, TimeoutError } from '../shared/errors/index.js';

interface GeocodeRequest {
  address: string;
}

export const createRoutingRoutes = (
  routingService: RoutingService,
  routingProvider: RoutingProvider
): FastifyPluginAsync => {
  return async (fastify) => {
    // POST /api/routing/matrix
    fastify.post<{ Body: MatrixParams }>('/api/routing/matrix', async (request, reply) => {
      const startTime = Date.now();

      try {
        const result = await routingService.calculateMatrix(request.body);

        const duration = Date.now() - startTime;

        fastify.log.info({
          route: '/api/routing/matrix',
          duration,
          fromCache: result.fromCache,
          originsCount: request.body.origins.length,
          destinationsCount: request.body.destinations.length
        });

        return result;
      } catch (error) {
        fastify.log.error({ route: '/api/routing/matrix', error });

        if (error instanceof QuotaExceededError) {
          return reply.code(503).send({
            error: 'Routing service quota exceeded. Please try again later.'
          });
        }

        if (error instanceof TimeoutError) {
          return reply.code(504).send({
            error: 'Routing API timeout. Please try again.'
          });
        }

        return reply.code(500).send({
          error: 'Internal server error'
        });
      }
    });

    // POST /api/geocode
    fastify.post<{ Body: GeocodeRequest }>('/api/geocode', async (request, reply) => {
      try {
        const { address } = request.body;

        if (!address || address.trim().length === 0) {
          return reply.code(400).send({
            error: 'Address is required'
          });
        }

        const coords = await routingProvider.geocode(address);

        fastify.log.info({
          route: '/api/geocode',
          address,
          coords
        });

        return coords;
      } catch (error) {
        fastify.log.error({ route: '/api/geocode', error });

        if (error instanceof TimeoutError) {
          return reply.code(504).send({
            error: 'Geocoding API timeout. Please try again.'
          });
        }

        return reply.code(500).send({
          error: 'Geocoding failed'
        });
      }
    });
  };
};
