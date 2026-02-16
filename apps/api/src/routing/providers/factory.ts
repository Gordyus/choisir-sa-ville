/**
 * Routing Provider Factory
 *
 * Creates the appropriate routing provider based on environment configuration.
 * Supports:
 * - smart: Valhalla for car/truck/pedestrian (historical traffic), Navitia for transit
 * - valhalla: Valhalla only (all modes, self-hosted)
 * - tomtom: TomTom only (all modes, cloud API)
 * - navitia: Navitia only (all modes, French transit)
 * - mock: Development/testing (no external calls)
 */

import type { RoutingProvider } from './interface.js';
import { ValhallaProvider } from './ValhallaProvider.js';
import { TomTomProvider } from './TomTomProvider.js';
import { NavitiaProvider } from './NavitiaProvider.js';
import { MockProvider } from './MockProvider.js';
import { SmartRoutingProvider } from './SmartRoutingProvider.js';
import { env } from '../../config/validateEnv.js';

export function createRoutingProvider(): RoutingProvider {
  switch (env.ROUTING_PROVIDER) {
    case 'smart': {
      // Smart mode: Valhalla for car/truck/pedestrian (historical traffic), Navitia for transit
      if (!env.NAVITIA_API_KEY || !env.VALHALLA_BASE_URL) {
        throw new Error('Both NAVITIA_API_KEY and VALHALLA_BASE_URL are required when ROUTING_PROVIDER=smart');
      }

      const navitia = new NavitiaProvider(env.NAVITIA_API_KEY);
      const valhalla = new ValhallaProvider(env.VALHALLA_BASE_URL);

      return new SmartRoutingProvider({
        transit: navitia,
        car: valhalla,
        truck: valhalla,
        pedestrian: valhalla,
        default: valhalla  // Fallback to Valhalla for unknown modes
      });
    }
    
    case 'valhalla':
      if (!env.VALHALLA_BASE_URL) {
        throw new Error('VALHALLA_BASE_URL is required when ROUTING_PROVIDER=valhalla');
      }
      return new ValhallaProvider(env.VALHALLA_BASE_URL);

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
        `Unknown routing provider: ${env.ROUTING_PROVIDER}. Valid options: smart, valhalla, tomtom, navitia, mock`
      );
  }
}
