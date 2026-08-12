import { describe, expect, it } from 'vitest';
import type { RankingItem } from './gameApi';
import {
  chooseBetterDuration,
  compareRankingItems,
  hasSameRankingRecord,
} from './rankingRules';

const record = (score: number, durationMs: number | null): RankingItem => ({
  rank: 0,
  displayName: '테스트 #1000',
  score,
  durationMs,
});

describe('ranking rules', () => {
  it('prefers a longer breath when lung-test scores are tied', () => {
    expect(chooseBetterDuration('LUNG_CAPACITY', 8_000, 10_000)).toBe(10_000);
    expect(
      [record(1_000, 8_000), record(1_000, 10_000)].sort((a, b) =>
        compareRankingItems('LUNG_CAPACITY', a, b),
      )[0]?.durationMs,
    ).toBe(10_000);
  });

  it('prefers a faster final completion when rush counts are tied', () => {
    expect(chooseBetterDuration('BALLOON_COUNT', 18_000, 16_000)).toBe(16_000);
    expect(
      [record(20, 18_000), record(20, 16_000)].sort((a, b) =>
        compareRankingItems('BALLOON_COUNT', a, b),
      )[0]?.durationMs,
    ).toBe(16_000);
  });

  it('treats records as tied only when score and duration both match', () => {
    expect(hasSameRankingRecord(record(20, 16_000), record(20, 16_000))).toBe(true);
    expect(hasSameRankingRecord(record(20, 16_000), record(20, 17_000))).toBe(false);
  });
});
