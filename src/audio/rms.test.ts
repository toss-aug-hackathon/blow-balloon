import { describe, expect, it } from 'vitest';
import { calculateRms, normalizeWindStrength } from './rms';

describe('calculateRms', () => {
  it('returns the root mean square of audio samples', () => {
    expect(calculateRms(new Float32Array([1, -1, 1, -1]))).toBe(1);
    expect(calculateRms(new Float32Array([0, 0, 0]))).toBe(0);
  });
});

describe('normalizeWindStrength', () => {
  it('clamps the normalized value between zero and one', () => {
    expect(normalizeWindStrength(0.004, 0.005, 0.02, 10)).toBe(0);
    expect(normalizeWindStrength(1, 0.005, 0.02, 10)).toBe(1);
  });
});
