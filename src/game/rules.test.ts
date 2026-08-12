import { describe, expect, it } from 'vitest';
import {
  LUNG_MAX_GROWTH_DURATION_MS,
  MAX_RUSH_BALLOON_COUNT,
  calculateAverageWind,
  calculateBalloonScore,
  calculateWindGrowthMultiplier,
  getLungScoreTitle,
  hasLungBreathEnded,
  hasRushTimeExpired,
  isBalloonComplete,
} from './rules';

describe('game rules', () => {
  it('allows up to 50 completed balloons in rush mode', () => {
    expect(MAX_RUSH_BALLOON_COUNT).toBe(50);
  });

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
    expect(isBalloonComplete(50.99)).toBe(false);
    expect(isBalloonComplete(51)).toBe(true);
  });

  it('ends a lung breath after a 150ms signal gap', () => {
    expect(hasLungBreathEnded(149)).toBe(false);
    expect(hasLungBreathEnded(150)).toBe(true);
  });

  it('calculates duration-weighted lung values', () => {
    expect(calculateAverageWind(2400, 4000)).toBeCloseTo(0.6);
    expect(calculateAverageWind(0, 0)).toBe(0);
    expect(calculateBalloonScore(22, 22)).toBe(0);
    expect(calculateBalloonScore(66, 22)).toBeGreaterThan(0);
    expect(calculateBalloonScore(66, 22)).toBeLessThan(2);
    expect(calculateBalloonScore(300, 22)).toBeGreaterThan(
      calculateBalloonScore(66, 22),
    );
    expect(Math.round(calculateBalloonScore(220, 22) * 100)).toBeGreaterThan(1_000);
    expect(calculateBalloonScore(9999, 22)).toBeCloseTo(99.99);
  });

  it('assigns lung-test titles from the actual balloon score', () => {
    expect(getLungScoreTitle(0)).toBe('첫 바람을 기다려요');
    expect(getLungScoreTitle(1_199)).toBe('호흡 유망주');
    expect(getLungScoreTitle(3_200)).toBe('풍선 장인');
    expect(getLungScoreTitle(9_800)).toBe('바람의 전설');
  });
});
