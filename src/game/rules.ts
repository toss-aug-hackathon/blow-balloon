import { clamp } from '../utils/math';

export const BALLOON_RUSH_DURATION_MS = 30_000;
export const MAX_RUSH_BALLOON_COUNT = 50;
export const MAX_BALLOON_SCORE_RATIO = 99.99;
export const BALLOON_SCORE_MAX_RADIUS_MULTIPLIER = 40;
export const BALLOON_SCORE_CURVE_EXPONENT = 1.5;
export const RUSH_MAX_RADIUS = 54;
export const RUSH_COMPLETION_RADIUS = 51;
export const LUNG_END_GRACE_MS = 150;
export const LUNG_MAX_GROWTH_DURATION_MS = 15_000;

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
  if (baseRadius <= 0 || !Number.isFinite(averageRadius)) return 0;

  // The starting balloon is 0 points. A curved scale keeps early gains
  // controlled, while 9,999 requires roughly forty times the starting size.
  const maximumRadius = baseRadius * BALLOON_SCORE_MAX_RADIUS_MULTIPLIER;
  const normalizedGrowth = clamp(
    (averageRadius - baseRadius) /
      Math.max(1, maximumRadius - baseRadius),
    0,
    1,
  );

  return (
    MAX_BALLOON_SCORE_RATIO *
    Math.pow(normalizedGrowth, BALLOON_SCORE_CURVE_EXPONENT)
  );
}

export function getLungScoreTitle(score: number): string {
  if (score >= 9_800) return '바람의 전설';
  if (score >= 9_000) return '한계 돌파자';
  if (score >= 7_500) return '초대형 풍선 마스터';
  if (score >= 6_000) return '바람의 지배자';
  if (score >= 4_500) return '거대 풍선 전문가';
  if (score >= 3_200) return '풍선 장인';
  if (score >= 2_000) return '풍선 숙련가';
  if (score >= 1_200) return '풍선 키우기 능력자';
  if (score >= 600) return '호흡 유망주';
  if (score >= 200) return '풍선 새싹';
  if (score > 0) return '말랑한 첫 풍선';
  return '첫 바람을 기다려요';
}
