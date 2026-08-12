import type { GameType } from '../api/gameApi';

const RANKING_BALLOON_ASSET_IDS: Record<GameType, readonly number[]> = {
  LUNG_CAPACITY: [6, 10, 1, 13, 8, 9, 11, 15, 12, 2, 3, 4, 5, 7, 14],
  BALLOON_COUNT: [1, 12, 2, 13, 8, 9, 11, 15, 6, 10, 3, 4, 5, 7, 14],
};

export function getRankingBalloonSrc(
  gameType: GameType,
  rank: number,
): string {
  const assetIds = RANKING_BALLOON_ASSET_IDS[gameType];
  const normalizedRank = Math.max(1, Math.floor(rank));
  const assetId = assetIds[(normalizedRank - 1) % assetIds.length] ?? assetIds[0]!;
  const folder = gameType === 'LUNG_CAPACITY' ? 'lung-test' : 'balloon-rush';
  return `/balloons/${folder}/balloon_${String(assetId).padStart(2, '0')}.webp`;
}
