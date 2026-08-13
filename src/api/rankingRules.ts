import type { RankingType, RankingItem } from './rankingApi';

export function chooseBetterDuration(
  rankingType: RankingType,
  current: number | null,
  candidate: number | null,
): number | null {
  if (current === null) return candidate;
  if (candidate === null) return current;
  return rankingType === 'LUNG_CAPACITY'
    ? Math.max(current, candidate)
    : Math.min(current, candidate);
}

export function compareRankingItems(
  rankingType: RankingType,
  a: RankingItem,
  b: RankingItem,
): number {
  const scoreDifference = b.score - a.score;
  if (scoreDifference !== 0) return scoreDifference;
  if (a.durationMs === null) return b.durationMs === null ? 0 : 1;
  if (b.durationMs === null) return -1;
  return rankingType === 'LUNG_CAPACITY'
    ? b.durationMs - a.durationMs
    : a.durationMs - b.durationMs;
}

export function hasSameRankingRecord(
  a: RankingItem,
  b: RankingItem,
): boolean {
  return a.score === b.score && a.durationMs === b.durationMs;
}

export function calculateExpectedRank(
  rankingType: RankingType,
  ranking: RankingItem[],
  score: number,
  durationMs: number | null,
): number {
  const current = { rank: 0, displayName: '', score, durationMs };
  return 1 + ranking.filter((item) => compareRankingItems(rankingType, item, current) < 0).length;
}
