/**
 * Swagger/OpenAPI Configuration
 */

export const swaggerOptions = {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'Choisir Sa Ville - Routing API',
      description: 'Backend API for travel time calculations with intelligent caching',
      version: '1.0.0'
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      }
    ]
  }
};

export const swaggerUiOptions = {
  routePrefix: '/docs',
  exposeRoute: true
};
