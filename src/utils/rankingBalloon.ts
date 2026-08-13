import type { RankingType } from '../api/rankingApi';

const RANKING_BALLOON_ASSET_IDS: Record<RankingType, readonly number[]> = {
  LUNG_CAPACITY: [6, 10, 1, 13, 8, 9, 11, 15, 12, 2, 3, 4, 5, 7, 14],
  BALLOON_COUNT: [1, 12, 2, 13, 8, 9, 11, 15, 6, 10, 3, 4, 5, 7, 14],
};

export function getRankingBalloonSrc(
  rankingType: RankingType,
  rank: number,
): string {
  const assetIds = RANKING_BALLOON_ASSET_IDS[rankingType];
  const normalizedRank = Math.max(1, Math.floor(rank));
  const assetId = assetIds[(normalizedRank - 1) % assetIds.length] ?? assetIds[0]!;
  const folder = rankingType === 'LUNG_CAPACITY' ? 'lung-test' : 'balloon-rush';
  return `/balloons/${folder}/balloon_${String(assetId).padStart(2, '0')}.webp`;
}
