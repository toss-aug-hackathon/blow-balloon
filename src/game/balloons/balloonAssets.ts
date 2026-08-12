export type BalloonAsset = {
  id: number;
  sourceId: number;
  width: number;
  height: number;
  lungTestUrl: string;
  balloonRushUrl: string;
  face: {
    x: number;
    y: number;
    scale: number;
  };
};

const DIMENSIONS: ReadonlyArray<readonly [number, number]> = [
  [1254, 1254], // 01 star
  [1024, 1536], // 02 clover
  [1024, 1536], // 03 twist
  [1024, 1536], // 04 patterned round
  [1024, 1536], // 05 round
  [1024, 1536], // 06 heart with surrounding balloons
  [1024, 1536], // 07 round
  [1536, 1024], // 08 cloud
  [1024, 1536], // 09 flower
  [1024, 1536], // 10 shell
  [1536, 1024], // 11 candy
  [1024, 1536], // 12 heart
  [1024, 1536], // 13 bunny
  [1254, 1254], // 14 wave
  [1024, 1536], // 15 crescent
];

const FACE_PLACEMENTS: ReadonlyArray<readonly [number, number, number]> = [
  [0.5, 0.39, 0.3], // 01 star
  [0.5, 0.12, 0.28], // 02 clover
  [0.5, 0.3, 0.18], // 03 twist
  [0.5, 0.32, 0.32], // 04 patterned round
  [0.5, 0.34, 0.36], // 05 round
  [0.5, 0.27, 0.4], // 06 heart with surrounding balloons
  [0.5, 0.33, 0.36], // 07 round
  [0.5, 0.32, 0.24], // 08 cloud
  [0.5, 0.42, 0.24], // 09 flower
  [0.5, 0.31, 0.28], // 10 shell
  [0.5, 0.25, 0.24], // 11 candy
  [0.5, 0.34, 0.35], // 12 heart
  [0.5, 0.38, 0.3], // 13 bunny
  [0.5, 0.34, 0.18], // 14 wave
  [0.5, 0.36, 0.22], // 15 crescent
];

const SOURCE_ASSET_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
] as const;

export const BALLOON_ASSETS: readonly BalloonAsset[] = SOURCE_ASSET_IDS.map(
  (sourceId) => {
    const [width, height] = DIMENSIONS[sourceId - 1] ?? DIMENSIONS[0]!;
    const filename = `balloon_${String(sourceId).padStart(2, '0')}.webp`;
    const [faceX, faceY, faceScale] =
      FACE_PLACEMENTS[sourceId - 1] ?? FACE_PLACEMENTS[0]!;
    return {
      id: sourceId,
      sourceId,
      width,
      height,
      lungTestUrl: `/balloons/lung-test/${filename}`,
      balloonRushUrl: `/balloons/balloon-rush/${filename}`,
      face: { x: faceX, y: faceY, scale: faceScale },
    };
  },
);

const imageCache = new Map<number, HTMLImageElement>();

export function getBalloonAsset(assetId: number): BalloonAsset {
  return (
    BALLOON_ASSETS.find(({ id }) => id === assetId) ?? BALLOON_ASSETS[0]!
  );
}

export function getBalloonImage(assetId: number): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const asset = getBalloonAsset(assetId);
  const cached = imageCache.get(asset.id);
  if (cached) return cached;

  const image = new Image();
  image.decoding = 'async';
  image.src = asset.balloonRushUrl;
  imageCache.set(asset.id, image);
  return image;
}

const fullResolutionCache = new Map<number, HTMLImageElement>();

export function getFullResolutionBalloonImage(
  assetId: number,
): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const asset = getBalloonAsset(assetId);
  const cached = fullResolutionCache.get(asset.id);
  if (cached) return cached;

  const image = new Image();
  image.decoding = 'async';
  image.src = asset.lungTestUrl;
  fullResolutionCache.set(asset.id, image);
  return image;
}

export async function preloadBalloonAssets(): Promise<void> {
  await Promise.all(
    BALLOON_ASSETS.flatMap(({ id }) => [
      getBalloonImage(id),
      getFullResolutionBalloonImage(id),
    ]).map(async (image) => {
      if (!image || (image.complete && image.naturalWidth > 0)) return;

      await new Promise<void>((resolve, reject) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener(
          'error',
          () => reject(new Error('풍선 이미지를 불러오지 못했어요.')),
          { once: true },
        );
      });
    }),
  );
}
