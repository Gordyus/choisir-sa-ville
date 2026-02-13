/**
 * Routing endpoints
 * POST /api/routing/matrix - Calculate travel time matrix
 */

import type { FastifyPluginAsync } from 'fastify';
import type { RoutingService } from './service.js';
import type { MatrixParams, RoutingProvider } from './providers/interface.js';
import { QuotaExceededError, TimeoutError } from '../shared/errors/index.js';

export const createRoutingRoutes = (
  routingService: RoutingService,
  routingProvider: RoutingProvider
): FastifyPluginAsync => {
  return async (fastify) => {
    // POST /api/routing/matrix
    fastify.post<{ Body: MatrixParams }>(
      '/api/routing/matrix',
      {
        schema: {
          tags: ['Routing'],
          summary: 'Calculate travel times and distances',
          description: 'Calculates travel times and distances between origins and destinations. Supports either departure time or arrival time (mutually exclusive). Returns route geometry for map display.',
          body: {
            type: 'object',
            required: ['origins', 'destinations'],
            properties: {
              origins: {
                type: 'array',
                minItems: 1,
                maxItems: 1,
                items: {
                  type: 'object',
                  required: ['lat', 'lng'],
                  properties: {
                    lat: { type: 'number', description: 'Latitude' },
                    lng: { type: 'number', description: 'Longitude' }
                  }
                },
                description: 'Starting points (typically 1 for MVP)'
              },
              destinations: {
                type: 'array',
                minItems: 1,
                maxItems: 100,
                items: {
                  type: 'object',
                  required: ['lat', 'lng'],
                  properties: {
                    lat: { type: 'number', description: 'Latitude' },
                    lng: { type: 'number', description: 'Longitude' }
                  }
                },
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
              description: 'Successful response with travel times, distances, and route geometries',
              type: 'object',
              required: ['durations', 'distances', 'routes', 'fromCache'],
              properties: {
                durations: {
                  type: 'array',
                  description: 'Travel times in seconds (originIndex x destinationIndex)',
                  items: { type: 'array', items: { type: 'number' } }
                },
                distances: {
                  type: 'array',
                  description: 'Travel distances in meters (originIndex x destinationIndex)',
                  items: { type: 'array', items: { type: 'number' } }
                },
                routes: {
                  type: 'array',
                  description: 'Route geometries for map display (originIndex x destinationIndex)',
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        points: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              lat: { type: 'number' },
                              lng: { type: 'number' }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                fromCache: {
                  type: 'boolean',
                  description: 'Whether result was fetched from cache'
                }
              }
            },
            400: {
              description: 'Bad request',
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' }
              }
            },
            429: {
              description: 'Too many requests - rate limit exceeded',
              type: 'object',
              properties: { error: { type: 'string' } }
            },
            503: {
              description: 'Routing API quota exceeded',
              type: 'object',
              properties: { error: { type: 'string' } }
            },
            504: {
              description: 'Routing API timeout',
              type: 'object',
              properties: { error: { type: 'string' } }
            }
          }
        }
      },
      async (request, reply) => {
        const startTime = Date.now();

        // Validate mutually exclusive departureTime/arrivalTime
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
      }
    );
  };
};
