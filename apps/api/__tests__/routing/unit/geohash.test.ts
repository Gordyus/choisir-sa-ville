/**
 * Unit tests for geohash snapping
 */

import { describe, it, expect } from 'vitest';
import { snapToGeohash } from '../../../src/routing/utils/geohash';

describe('snapToGeohash', () => {
  it('should snap coordinates to geohash6', () => {
    const coords = { lat: 43.6108, lng: 3.8767 };
    const hash = snapToGeohash(coords, 6);
    
    expect(hash).toBe('spfb05');
    expect(hash.length).toBe(6);
  });

  it('should snap nearby points to same geohash', () => {
    const coords1 = { lat: 43.6108, lng: 3.8767 };
    const coords2 = { lat: 43.6120, lng: 3.8775 }; // Very close (~150m away)
    
    const hash1 = snapToGeohash(coords1, 6);
    const hash2 = snapToGeohash(coords2, 6);
    
    expect(hash1).toBe(hash2);
  });

  it('should create different geohashes for distant points', () => {
    const montpellier = { lat: 43.6108, lng: 3.8767 };
    const paris = { lat: 48.8566, lng: 2.3522 };
    
    const hash1 = snapToGeohash(montpellier, 6);
    const hash2 = snapToGeohash(paris, 6);
    
    expect(hash1).not.toBe(hash2);
  });

  it('should respect precision parameter', () => {
    const coords = { lat: 43.6108, lng: 3.8767 };
    
    const hash4 = snapToGeohash(coords, 4);
    const hash6 = snapToGeohash(coords, 6);
    const hash8 = snapToGeohash(coords, 8);
    
    expect(hash4.length).toBe(4);
    expect(hash6.length).toBe(6);
    expect(hash8.length).toBe(8);
  });
});
