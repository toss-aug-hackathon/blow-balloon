import { clamp } from '../utils/math';

export const BALLOON_RUSH_DURATION_MS = 30_000;
export const MAX_RUSH_BALLOON_COUNT = 30;
export const MAX_BALLOON_SCORE_RATIO = 9.99;
export const RUSH_MAX_RADIUS = 54;
export const RUSH_COMPLETION_RADIUS = 51;
export const LUNG_MAX_GROWTH_DURATION_MS = 15_000;

export function hasRushTimeExpired(elapsedMs: number): boolean {
  return elapsedMs >= BALLOON_RUSH_DURATION_MS;
}

export function isBalloonComplete(averageRadius: number): boolean {
  return averageRadius >= RUSH_COMPLETION_RADIUS;
}

export function calculateAverageWind(
  windIntegral: number,
  blowingDurationMs: number,
): number {
  if (blowingDurationMs <= 0) return 0;
  return clamp(windIntegral / blowingDurationMs, 0, 1);
}

/**
 * Converts the smoothed microphone strength into a growth-speed multiplier.
 * A gentle breath still grows the balloon, while a stronger, steady breath
 * noticeably shortens the time needed to reach the target size.
 */
export function calculateWindGrowthMultiplier(windStrength: number): number {
  return 0.84 + clamp(windStrength, 0, 1) * 0.32;
}

export function calculateBalloonScore(
  averageRadius: number,
  baseRadius: number,
): number {
  return Math.min(
    MAX_BALLOON_SCORE_RATIO,
    Math.max(1, averageRadius / baseRadius),
  );
}
