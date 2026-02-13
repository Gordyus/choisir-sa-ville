/**
 * Routing Provider Factory
 * 
 * Creates the appropriate routing provider based on environment configuration.
 * Supports: 
 * - smart: Navitia for transit, TomTom for car (requires both API keys)
 * - tomtom: TomTom only (all modes)
 * - navitia: Navitia only (all modes)
 * - mock: Development/testing (no external calls)
 */

import type { RoutingProvider } from './interface.js';
import { TomTomProvider } from './TomTomProvider.js';
import { NavitiaProvider } from './NavitiaProvider.js';
import { MockProvider } from './MockProvider.js';
import { SmartRoutingProvider } from './SmartRoutingProvider.js';
import { env } from '../../config/validateEnv.js';

export function createRoutingProvider(): RoutingProvider {
  switch (env.ROUTING_PROVIDER) {
    case 'smart': {
      // Smart mode: Navitia for transit, TomTom for car
      if (!env.NAVITIA_API_KEY || !env.TOMTOM_API_KEY) {
        throw new Error('Both NAVITIA_API_KEY and TOMTOM_API_KEY are required when ROUTING_PROVIDER=smart');
      }
      
      const navitia = new NavitiaProvider(env.NAVITIA_API_KEY);
      const tomtom = new TomTomProvider(env.TOMTOM_API_KEY);
      
      return new SmartRoutingProvider({
        transit: navitia,
        car: tomtom,
        truck: tomtom,
        pedestrian: tomtom,
        default: tomtom  // Fallback to TomTom for unknown modes
      });
    }
    
    case 'tomtom':
      if (!env.TOMTOM_API_KEY) {
        throw new Error('TOMTOM_API_KEY is required when ROUTING_PROVIDER=tomtom');
      }
      return new TomTomProvider(env.TOMTOM_API_KEY);
    
    case 'navitia':
      if (!env.NAVITIA_API_KEY) {
        throw new Error('NAVITIA_API_KEY is required when ROUTING_PROVIDER=navitia');
      }
      return new NavitiaProvider(env.NAVITIA_API_KEY);
    
    case 'mock':
      return new MockProvider();
    
    default:
      throw new Error(
        `Unknown routing provider: ${env.ROUTING_PROVIDER}. Valid options: smart, tomtom, navitia, mock`
      );
  }
}
