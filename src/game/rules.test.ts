import { describe, expect, it } from 'vitest';
import {
  LUNG_MAX_GROWTH_DURATION_MS,
  calculateAverageWind,
  calculateBalloonScore,
  calculateWindGrowthMultiplier,
  hasLungBreathEnded,
  hasRushTimeExpired,
  isBalloonComplete,
} from './rules';

describe('game rules', () => {
  it('uses 15 seconds as the base lung-test growth duration', () => {
    expect(LUNG_MAX_GROWTH_DURATION_MS).toBe(15_000);
  });

  it('makes stronger wind grow balloons faster', () => {
    expect(calculateWindGrowthMultiplier(0)).toBeCloseTo(0.84);
    expect(calculateWindGrowthMultiplier(1)).toBeCloseTo(1.16);
    expect(calculateWindGrowthMultiplier(0.8)).toBeGreaterThan(
      calculateWindGrowthMultiplier(0.2),
    );
  });

  it('finishes rush mode at exactly 30 seconds', () => {
    expect(hasRushTimeExpired(29_999)).toBe(false);
    expect(hasRushTimeExpired(30_000)).toBe(true);
  });

  it('counts only balloons that reached the completion radius', () => {
    expect(isBalloonComplete(58.99)).toBe(false);
    expect(isBalloonComplete(59)).toBe(true);
  });

  it('ends a lung breath after a 150ms signal gap', () => {
    expect(hasLungBreathEnded(149)).toBe(false);
    expect(hasLungBreathEnded(150)).toBe(true);
  });

  it('calculates duration-weighted lung values', () => {
    expect(calculateAverageWind(2400, 4000)).toBeCloseTo(0.6);
    expect(calculateAverageWind(0, 0)).toBe(0);
    expect(calculateBalloonScore(66, 22)).toBe(3);
    expect(calculateBalloonScore(999, 22)).toBeCloseTo(9.99);
  });
});
