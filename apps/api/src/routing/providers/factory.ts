/**
 * Routing Provider Factory
 * 
 * Creates the appropriate routing provider based on environment configuration.
 */

import type { RoutingProvider } from './interface.js';
import { TomTomProvider } from './TomTomProvider.js';
import { MockProvider } from './MockProvider.js';
import { env } from '../../config/validateEnv.js';

export function createRoutingProvider(): RoutingProvider {
  switch (env.ROUTING_PROVIDER) {
    case 'tomtom':
      if (!env.TOMTOM_API_KEY) {
        throw new Error('TOMTOM_API_KEY is required when ROUTING_PROVIDER=tomtom');
      }
      return new TomTomProvider(env.TOMTOM_API_KEY);
    
    case 'mock':
      return new MockProvider();
    
    default:
      throw new Error(`Unknown routing provider: ${env.ROUTING_PROVIDER}`);
  }
}
