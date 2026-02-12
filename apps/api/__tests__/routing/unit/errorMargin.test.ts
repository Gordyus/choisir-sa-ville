/**
 * Unit tests for error margin
 */

import { describe, it, expect } from 'vitest';
import { applyErrorMargin } from '../../../src/routing/utils/errorMargin';

describe('applyErrorMargin', () => {
  it('should apply 10% margin by default', () => {
    expect(applyErrorMargin(1800)).toBe(1980); // 1800 * 1.10 = 1980
    expect(applyErrorMargin(3600)).toBe(3960); // 3600 * 1.10 = 3960
    expect(applyErrorMargin(1000)).toBe(1100); // 1000 * 1.10 = 1100
  });

  it('should apply custom margin percentage', () => {
    expect(applyErrorMargin(1800, 15)).toBe(2070); // 1800 * 1.15 = 2070
    expect(applyErrorMargin(1800, 20)).toBe(2160); // 1800 * 1.20 = 2160
    expect(applyErrorMargin(1800, 5)).toBe(1890); // 1800 * 1.05 = 1890
  });

  it('should round to nearest integer', () => {
    expect(applyErrorMargin(1234, 10)).toBe(1357); // 1234 * 1.10 = 1357.4 → 1357
    expect(applyErrorMargin(1235, 10)).toBe(1359); // 1235 * 1.10 = 1358.5 → 1359
  });

  it('should handle zero margin', () => {
    expect(applyErrorMargin(1800, 0)).toBe(1800);
  });

  it('should handle zero duration', () => {
    expect(applyErrorMargin(0, 10)).toBe(0);
  });

  it('should handle large durations', () => {
    expect(applyErrorMargin(86400, 10)).toBe(95040); // 24h * 1.10
  });
});
