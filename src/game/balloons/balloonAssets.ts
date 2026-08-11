export type BalloonAsset = {
  id: number;
  width: number;
  height: number;
  url: string;
};

const DIMENSIONS: ReadonlyArray<readonly [number, number]> = [
  [144, 215], [99, 230], [128, 218], [87, 238], [160, 216], [131, 214],
  [130, 215], [148, 222], [167, 203], [136, 229], [159, 213], [125, 206],
  [153, 210], [194, 202], [134, 215], [157, 195], [143, 190], [143, 194],
  [100, 224], [101, 212], [157, 206], [93, 210], [157, 198], [131, 194],
  [116, 195], [152, 202], [162, 168], [138, 200], [129, 193], [146, 202],
  [130, 199], [141, 185], [133, 207], [150, 199], [123, 199], [194, 181],
];

export const BALLOON_ASSETS: readonly BalloonAsset[] = DIMENSIONS.map(
  ([width, height], index) => {
    const id = index + 1;
    return {
      id,
      width,
      height,
      url: `/balloons/balloon_${String(id).padStart(2, '0')}.svg`,
    };
  },
);

const imageCache = new Map<number, HTMLImageElement>();

export function getBalloonAsset(assetId: number): BalloonAsset {
  return BALLOON_ASSETS[assetId - 1] ?? BALLOON_ASSETS[0]!;
}

export function getBalloonImage(assetId: number): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const asset = getBalloonAsset(assetId);
  const cached = imageCache.get(asset.id);
  if (cached) return cached;

  const image = new Image();
  image.decoding = 'async';
  image.src = asset.url;
  imageCache.set(asset.id, image);
  return image;
}

export async function preloadBalloonAssets(): Promise<void> {
  await Promise.all(
    BALLOON_ASSETS.map(async ({ id }) => {
      const image = getBalloonImage(id);
      if (!image || (image.complete && image.naturalWidth > 0)) return;

      await new Promise<void>((resolve, reject) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener(
          'error',
          () => reject(new Error(`풍선 이미지 ${id}번을 불러오지 못했어요.`)),
          { once: true },
        );
      });
    }),
  );
}
