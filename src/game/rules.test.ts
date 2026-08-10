import { describe, expect, it } from 'vitest';
import {
  calculateAverageWind,
  calculateBalloonScore,
  hasRushTimeExpired,
  isBalloonComplete,
} from './rules';

describe('game rules', () => {
  it('finishes rush mode at exactly 60 seconds', () => {
    expect(hasRushTimeExpired(59_999)).toBe(false);
    expect(hasRushTimeExpired(60_000)).toBe(true);
  });

  it('counts only balloons that reached the completion radius', () => {
    expect(isBalloonComplete(58.99)).toBe(false);
    expect(isBalloonComplete(59)).toBe(true);
  });

  it('calculates duration-weighted lung values', () => {
    expect(calculateAverageWind(2400, 4000)).toBeCloseTo(0.6);
    expect(calculateAverageWind(0, 0)).toBe(0);
    expect(calculateBalloonScore(66, 22)).toBe(3);
  });
});
