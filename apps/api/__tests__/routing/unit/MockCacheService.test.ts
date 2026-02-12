/**
 * Unit tests for MockCacheService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockCacheService } from '../../../src/routing/cache/MockCacheService';

describe('MockCacheService', () => {
  let cache: MockCacheService;

  beforeEach(() => {
    cache = new MockCacheService();
  });

  it('should return null for non-existent key', async () => {
    const result = await cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should store and retrieve value', async () => {
    await cache.set('key1', 1800, 30);
    const result = await cache.get('key1');
    expect(result).toBe(1800);
  });

  it('should return null for expired entry', async () => {
    // Set with very short TTL
    await cache.set('key1', 1800, 0.00001); // ~0.864 seconds
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const result = await cache.get('key1');
    expect(result).toBeNull();
  });

  it('should overwrite existing key', async () => {
    await cache.set('key1', 1800, 30);
    await cache.set('key1', 3600, 30);
    
    const result = await cache.get('key1');
    expect(result).toBe(3600);
  });

  it('should track cache size', async () => {
    expect(cache.getSize()).toBe(0);
    
    await cache.set('key1', 1800, 30);
    expect(cache.getSize()).toBe(1);
    
    await cache.set('key2', 3600, 30);
    expect(cache.getSize()).toBe(2);
  });

  it('should clear all entries', async () => {
    await cache.set('key1', 1800, 30);
    await cache.set('key2', 3600, 30);
    
    expect(cache.getSize()).toBe(2);
    
    cache.clear();
    
    expect(cache.getSize()).toBe(0);
    expect(await cache.get('key1')).toBeNull();
  });

  it('should remove expired entry from store on get', async () => {
    await cache.set('key1', 1800, 0.00001);
    expect(cache.getSize()).toBe(1);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await cache.get('key1');
    expect(cache.getSize()).toBe(0);
  });
});
