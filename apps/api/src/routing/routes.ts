/**
 * Routing endpoints
 * POST /api/routing/matrix - Bulk travel time/distance calculations (no geometry)
 * POST /api/routing/route  - Single route with GeoJSON geometry for map display
 */

import type { FastifyPluginAsync } from 'fastify';
import type { RoutingService } from './service.js';
import type { MatrixParams, RouteParams } from './providers/interface.js';
import { QuotaExceededError, TimeoutError } from '../shared/errors/index.js';

// Shared coordinate schema
const coordinateSchema = {
  type: 'object' as const,
  required: ['lat', 'lng'],
  properties: {
    lat: { type: 'number' as const, description: 'Latitude' },
    lng: { type: 'number' as const, description: 'Longitude' }
  }
};

// Shared error responses
const errorResponses = {
  400: {
    description: 'Bad request',
    type: 'object' as const,
    properties: { error: { type: 'string' as const } }
  },
  429: {
    description: 'Too many requests',
    type: 'object' as const,
    properties: { error: { type: 'string' as const } }
  },
  503: {
    description: 'Routing API quota exceeded',
    type: 'object' as const,
    properties: { error: { type: 'string' as const } }
  },
  504: {
    description: 'Routing API timeout',
    type: 'object' as const,
    properties: { error: { type: 'string' as const } }
  }
};

export const createRoutingRoutes = (
  routingService: RoutingService
): FastifyPluginAsync => {
  return async (fastify) => {

    // POST /api/routing/matrix — Bulk calculations (no geometry)
    fastify.post<{ Body: MatrixParams }>(
      '/api/routing/matrix',
      {
        schema: {
          tags: ['Routing'],
          summary: 'Calculate travel times and distances (bulk)',
          description: 'Calculates travel times and distances between origins and destinations. Returns durations and distances only (no geometry). Use /api/routing/route for geometry.',
          body: {
            type: 'object',
            required: ['origins', 'destinations'],
            properties: {
              origins: {
                type: 'array',
                minItems: 1,
                maxItems: 10,
                items: coordinateSchema,
                description: 'Starting points'
              },
              destinations: {
                type: 'array',
                minItems: 1,
                maxItems: 100,
                items: coordinateSchema,
                description: 'Destination points'
              },
              departureTime: {
                type: 'string',
                format: 'date-time',
                description: 'ISO 8601 departure time (mutually exclusive with arrivalTime)'
              },
              arrivalTime: {
                type: 'string',
                format: 'date-time',
                description: 'ISO 8601 arrival time (mutually exclusive with departureTime)'
              },
              mode: {
                type: 'string',
                enum: ['car', 'truck', 'pedestrian'],
                default: 'car',
                description: 'Travel mode'
              }
            }
          },
          response: {
            200: {
              description: 'Travel times and distances matrix',
              type: 'object',
              required: ['durations', 'distances', 'fromCache'],
              properties: {
                durations: {
                  type: 'array',
                  description: 'Travel times in seconds (origins × destinations)',
                  items: { type: 'array', items: { type: 'number' } }
                },
                distances: {
                  type: 'array',
                  description: 'Distances in meters (origins × destinations)',
                  items: { type: 'array', items: { type: 'number' } }
                },
                fromCache: {
                  type: 'boolean',
                  description: 'Whether result was served from cache'
                }
              }
            },
            ...errorResponses
          }
        }
      },
      async (request, reply) => {
        if (!request.body.departureTime && !request.body.arrivalTime) {
          return reply.code(400).send({
            error: 'Either departureTime or arrivalTime must be provided'
          });
        }
        if (request.body.departureTime && request.body.arrivalTime) {
          return reply.code(400).send({
            error: 'departureTime and arrivalTime are mutually exclusive'
          });
        }

        try {
          const startTime = Date.now();
          const result = await routingService.calculateMatrix(request.body);

          fastify.log.info({
            route: '/api/routing/matrix',
            duration: Date.now() - startTime,
            fromCache: result.fromCache,
            originsCount: request.body.origins.length,
            destinationsCount: request.body.destinations.length
          });

          return result;
        } catch (error) {
          return handleRoutingError(fastify, reply, '/api/routing/matrix', error);
        }
      }
    );

    // POST /api/routing/route — Single route with GeoJSON geometry
    fastify.post<{ Body: RouteParams }>(
      '/api/routing/route',
      {
        schema: {
          tags: ['Routing'],
          summary: 'Calculate a single route with geometry',
          description: 'Returns duration, distance, and GeoJSON LineString geometry for map display. Use this on-demand when the user clicks a commune.',
          body: {
            type: 'object',
            required: ['origin', 'destination'],
            properties: {
              origin: { ...coordinateSchema, description: 'Starting point' },
              destination: { ...coordinateSchema, description: 'Destination point' },
              departureTime: {
                type: 'string',
                format: 'date-time',
                description: 'ISO 8601 departure time (mutually exclusive with arrivalTime)'
              },
              arrivalTime: {
                type: 'string',
                format: 'date-time',
                description: 'ISO 8601 arrival time (mutually exclusive with departureTime)'
              },
              mode: {
                type: 'string',
                enum: ['car', 'truck', 'pedestrian'],
                default: 'car',
                description: 'Travel mode'
              }
            }
          },
          response: {
            200: {
              description: 'Route with GeoJSON geometry for MapLibre',
              type: 'object',
              required: ['duration', 'distance', 'geometry'],
              properties: {
                duration: { type: 'number', description: 'Travel time in seconds' },
                distance: { type: 'number', description: 'Distance in meters' },
                geometry: {
                  type: 'object',
                  required: ['type', 'coordinates'],
                  properties: {
                    type: { type: 'string', enum: ['LineString'] },
                    coordinates: {
                      type: 'array',
                      description: '[lng, lat] pairs (GeoJSON format)',
                      items: {
                        type: 'array',
                        items: { type: 'number' },
                        minItems: 2,
                        maxItems: 2
                      }
                    }
                  }
                }
              }
            },
            ...errorResponses
          }
        }
      },
      async (request, reply) => {
        if (!request.body.departureTime && !request.body.arrivalTime) {
          return reply.code(400).send({
            error: 'Either departureTime or arrivalTime must be provided'
          });
        }
        if (request.body.departureTime && request.body.arrivalTime) {
          return reply.code(400).send({
            error: 'departureTime and arrivalTime are mutually exclusive'
          });
        }

        try {
          const startTime = Date.now();
          const result = await routingService.calculateRoute(request.body);

          fastify.log.info({
            route: '/api/routing/route',
            duration: Date.now() - startTime,
            pointsCount: result.geometry.coordinates.length
          });

          return result;
        } catch (error) {
          return handleRoutingError(fastify, reply, '/api/routing/route', error);
        }
      }
    );
  };
};

function handleRoutingError(
  fastify: { log: { error: (obj: unknown) => void } },
  reply: { code: (n: number) => { send: (obj: unknown) => unknown } },
  route: string,
  error: unknown
) {
  fastify.log.error({ route, error });

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
  return reply.code(500).send({ error: 'Internal server error' });
}
