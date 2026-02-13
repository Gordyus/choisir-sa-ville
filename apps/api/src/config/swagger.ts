/**
 * Swagger/OpenAPI Configuration
 */

export const swaggerOptions = {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'Choisir Sa Ville - Routing API',
      description: 'Backend API for travel time calculations with intelligent caching',
      version: '1.0.0',
      contact: {
        name: 'Choisir Sa Ville',
        url: 'https://choisir-sa-ville.fr'
      },
      license: {
        name: 'MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3005',
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
        Coordinates: {
          type: 'object',
          required: ['lat', 'lng'],
          properties: {
            lat: { type: 'number', description: 'Latitude', example: 43.6108 },
            lng: { type: 'number', description: 'Longitude', example: 3.8767 }
          }
        },
        MatrixRequest: {
          type: 'object',
          required: ['origins', 'destinations', 'departureTime', 'mode'],
          properties: {
            origins: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/Coordinates' },
              description: 'Starting points',
              example: [{ lat: 43.6108, lng: 3.8767 }]
            },
            destinations: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/Coordinates' },
              description: 'Destination points (max 100)',
              example: [{ lat: 48.8566, lng: 2.3522 }]
            },
            departureTime: {
              type: 'string',
              format: 'date-time',
              description: 'ISO 8601 departure time (e.g. 2026-03-15T08:30:00Z)',
              example: '2026-03-15T08:30:00Z'
            },
            mode: {
              type: 'string',
              enum: ['car', 'pedestrian', 'bicycle'],
              description: 'Travel mode',
              default: 'car',
              example: 'car'
            }
          }
        },
        MatrixResponse: {
          type: 'object',
          required: ['durations', 'distances', 'fromCache'],
          properties: {
            durations: {
              type: 'array',
              description: 'Travel times in seconds (originIndex x destinationIndex)',
              example: [[3600, 7200]]
            },
            distances: {
              type: 'array',
              description: 'Travel distances in meters (originIndex x destinationIndex)',
              example: [[120000, 450000]]
            },
            fromCache: {
              type: 'boolean',
              description: 'Whether result was fetched from cache',
              example: false
            }
          }
        },
        Health: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok'], example: 'ok' },
            version: { type: 'string', example: '1.0.0' },
            uptime: { type: 'number', example: 1234.5 },
            provider: { type: 'string', example: 'tomtom' },
            cache: {
              type: 'object',
              properties: { enabled: { type: 'boolean', example: false } }
            },
            environment: { type: 'string', enum: ['development', 'production'], example: 'development' }
          }
        },
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string', example: 'Bad Request' },
            message: { type: 'string', example: 'Invalid request body' },
            statusCode: { type: 'integer', example: 400 }
          }
        }
      }
    }
  }
};

export const swaggerUiOptions = {
  routePrefix: '/docs',
  exposeRoute: true,
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    presets: ['swagger-ui/dist/swagger-ui.js', 'swagger-ui/dist/swagger-ui-standalone-preset.js']
  }
};
