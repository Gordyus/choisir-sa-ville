/**
 * Mock Cache Service
 * 
 * In-memory cache implementation for MVP.
 * Data is lost on server restart.
 * Use PostgresCacheService for persistent caching in production.
 */

import type { CacheService } from './interface.js';

interface CacheEntry {
  duration: number;
  expiresAt: number;
}

export class MockCacheService implements CacheService {
  private store = new Map<string, CacheEntry>();

  async get(key: string): Promise<number | null> {
    const entry = this.store.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      // Entry expired, remove it
      this.store.delete(key);
      return null;
    }

    return entry.duration;
  }

  async set(key: string, durationSeconds: number, ttlDays: number): Promise<void> {
    const expiresAt = Date.now() + ttlDays * 86400 * 1000;
    
    this.store.set(key, {
      duration: durationSeconds,
      expiresAt
    });
  }

  /**
   * Get current cache size (for monitoring)
   */
  getSize(): number {
    return this.store.size;
  }

  /**
   * Clear all cache entries (for testing)
   */
  clear(): void {
    this.store.clear();
  }
}
