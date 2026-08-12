import type { GameType, RankingItem } from './gameApi';

export function chooseBetterDuration(
  gameType: GameType,
  current: number | null,
  candidate: number | null,
): number | null {
  if (current === null) return candidate;
  if (candidate === null) return current;
  return gameType === 'LUNG_CAPACITY'
    ? Math.max(current, candidate)
    : Math.min(current, candidate);
}

export function compareRankingItems(
  gameType: GameType,
  a: RankingItem,
  b: RankingItem,
): number {
  const scoreDifference = b.score - a.score;
  if (scoreDifference !== 0) return scoreDifference;
  if (a.durationMs === null) return b.durationMs === null ? 0 : 1;
  if (b.durationMs === null) return -1;
  return gameType === 'LUNG_CAPACITY'
    ? b.durationMs - a.durationMs
    : a.durationMs - b.durationMs;
}

export function hasSameRankingRecord(
  a: RankingItem,
  b: RankingItem,
): boolean {
  return a.score === b.score && a.durationMs === b.durationMs;
}
