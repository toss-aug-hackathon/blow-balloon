import { clamp } from '../utils/math';

export const BALLOON_RUSH_DURATION_MS = 30_000;
export const RUSH_COMPLETION_RADIUS = 59;
export const LUNG_END_GRACE_MS = 150;

export function hasLungBreathEnded(gapMs: number): boolean {
  return gapMs >= LUNG_END_GRACE_MS;
}

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

export function calculateBalloonScore(
  averageRadius: number,
  baseRadius: number,
): number {
  return Math.max(1, averageRadius / baseRadius);
}
