/**
 * Unit tests for time bucketing
 */

import { describe, it, expect } from 'vitest';
import { roundToTimeBucket } from '../../../src/routing/utils/timeBucket';

describe('roundToTimeBucket', () => {
  it('should round to 30-minute buckets by default', () => {
    expect(roundToTimeBucket('2026-03-15T08:17:00Z')).toBe('2026-03-15T08:00:00.000Z');
    expect(roundToTimeBucket('2026-03-15T08:43:00Z')).toBe('2026-03-15T08:30:00.000Z');
    expect(roundToTimeBucket('2026-03-15T08:00:00Z')).toBe('2026-03-15T08:00:00.000Z');
    expect(roundToTimeBucket('2026-03-15T08:29:59Z')).toBe('2026-03-15T08:00:00.000Z');
    expect(roundToTimeBucket('2026-03-15T08:30:00Z')).toBe('2026-03-15T08:30:00.000Z');
  });

  it('should round to custom bucket size', () => {
    expect(roundToTimeBucket('2026-03-15T08:17:00Z', 15)).toBe('2026-03-15T08:15:00.000Z');
    expect(roundToTimeBucket('2026-03-15T08:43:00Z', 15)).toBe('2026-03-15T08:30:00.000Z');
  });

  it('should handle hour boundaries correctly', () => {
    expect(roundToTimeBucket('2026-03-15T08:59:59Z', 30)).toBe('2026-03-15T08:30:00.000Z');
    expect(roundToTimeBucket('2026-03-15T09:01:00Z', 30)).toBe('2026-03-15T09:00:00.000Z');
  });

  it('should zero out seconds and milliseconds', () => {
    const result = roundToTimeBucket('2026-03-15T08:17:45.123Z', 30);
    expect(result).toBe('2026-03-15T08:00:00.000Z');
  });

  it('should handle 60-minute buckets', () => {
    expect(roundToTimeBucket('2026-03-15T08:17:00Z', 60)).toBe('2026-03-15T08:00:00.000Z');
    expect(roundToTimeBucket('2026-03-15T08:59:00Z', 60)).toBe('2026-03-15T08:00:00.000Z');
    expect(roundToTimeBucket('2026-03-15T09:01:00Z', 60)).toBe('2026-03-15T09:00:00.000Z');
  });
});
