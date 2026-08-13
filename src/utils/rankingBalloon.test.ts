import { describe, expect, it } from 'vitest';
import type { RankingType } from '../api/rankingApi';
import { getRankingBalloonSrc } from './rankingBalloon';

describe('ranking balloon placement', () => {
  it.each<RankingType>(['LUNG_CAPACITY', 'BALLOON_COUNT'])(
    'uses a different balloon for ranks 1 through 8 in %s',
    (rankingType) => {
      const sources = Array.from({ length: 8 }, (_, index) =>
        getRankingBalloonSrc(rankingType, index + 1),
      );
      expect(new Set(sources).size).toBe(8);
    },
  );

  it('uses the matching asset folder for each game mode', () => {
    expect(getRankingBalloonSrc('LUNG_CAPACITY', 1)).toContain('/lung-test/');
    expect(getRankingBalloonSrc('BALLOON_COUNT', 1)).toContain('/balloon-rush/');
  });
});
