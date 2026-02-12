/**
 * Unit tests for MockProvider
 */

import { describe, it, expect } from 'vitest';
import { MockProvider } from '../../../src/routing/providers/MockProvider';

describe('MockProvider', () => {
  const provider = new MockProvider();

  it('should calculate distance between two points', async () => {
    const result = await provider.calculateMatrix({
      origins: [{ lat: 43.6108, lng: 3.8767 }], // Montpellier
      destinations: [{ lat: 48.8566, lng: 2.3522 }], // Paris
      departureTime: '2026-03-15T08:30:00Z',
      mode: 'car'
    });

    expect(result.durations).toHaveLength(1);
    expect(result.durations[0]).toHaveLength(1);
    expect(result.distances).toHaveLength(1);
    expect(result.distances[0]).toHaveLength(1);

    // Montpellier-Paris ~600km straight line, at 80km/h ~7.5h = ~26700s
    const duration = result.durations[0]![0]!;
    expect(duration).toBeGreaterThan(25000);
    expect(duration).toBeLessThan(30000);

    const distance = result.distances[0]![0]!;
    expect(distance).toBeGreaterThan(580000);
    expect(distance).toBeLessThan(620000);
  });

  it('should return zero duration for same point', async () => {
    const result = await provider.calculateMatrix({
      origins: [{ lat: 43.6108, lng: 3.8767 }],
      destinations: [{ lat: 43.6108, lng: 3.8767 }],
      departureTime: '2026-03-15T08:30:00Z',
      mode: 'car'
    });

    expect(result.durations[0]![0]).toBe(0);
    expect(result.distances[0]![0]).toBe(0);
  });

  it('should handle multiple origins and destinations', async () => {
    const result = await provider.calculateMatrix({
      origins: [
        { lat: 43.6108, lng: 3.8767 }, // Montpellier
        { lat: 45.7640, lng: 4.8357 }  // Lyon
      ],
      destinations: [
        { lat: 48.8566, lng: 2.3522 }, // Paris
        { lat: 44.8378, lng: -0.5792 } // Bordeaux
      ],
      departureTime: '2026-03-15T08:30:00Z',
      mode: 'car'
    });

    expect(result.durations).toHaveLength(2);
    expect(result.durations[0]).toHaveLength(2);
    expect(result.durations[1]).toHaveLength(2);
    expect(result.distances).toHaveLength(2);
  });

  it('should return mock geocoding result', async () => {
    const coords = await provider.geocode('12 rue de Rivoli, Paris');
    
    expect(coords).toHaveProperty('lat');
    expect(coords).toHaveProperty('lng');
    expect(typeof coords.lat).toBe('number');
    expect(typeof coords.lng).toBe('number');
  });

  it('should return provider name', () => {
    expect(provider.getName()).toBe('mock');
  });
});
