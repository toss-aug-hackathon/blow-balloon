export type BalloonAsset = {
  id: number;
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
  [1254, 1254], [1024, 1536], [1024, 1536], [1024, 1536],
  [1024, 1536], [1024, 1536], [1024, 1536], [1536, 1024],
  [1024, 1536], [1024, 1536], [1536, 1024], [1254, 1254],
  [1024, 1536], [1024, 1536], [1254, 1254], [1024, 1536],
];

const FACE_PLACEMENTS: ReadonlyArray<readonly [number, number, number]> = [
  [0.5, 0.39, 0.3], // 01 star
  [0.5, 0.18, 0.18], // 02 clover
  [0.5, 0.3, 0.18], // 03 twist
  [0.5, 0.32, 0.32], // 04 patterned round
  [0.5, 0.34, 0.36], // 05 round
  [0.5, 0.34, 0.34], // 06 heart
  [0.5, 0.33, 0.36], // 07 round
  [0.5, 0.32, 0.24], // 08 cloud
  [0.5, 0.37, 0.24], // 09 flower
  [0.5, 0.31, 0.28], // 10 shell
  [0.5, 0.32, 0.24], // 11 candy
  [0.3, 0.29, 0.21], // 12 bow
  [0.5, 0.34, 0.35], // 13 heart
  [0.5, 0.38, 0.3], // 14 bunny
  [0.5, 0.34, 0.18], // 15 wave
  [0.36, 0.36, 0.22], // 16 crescent
];

export const BALLOON_ASSETS: readonly BalloonAsset[] = DIMENSIONS.map(
  ([width, height], index) => {
    const id = index + 1;
    const filename = `balloon_${String(id).padStart(2, '0')}.webp`;
    const [faceX, faceY, faceScale] =
      FACE_PLACEMENTS[index] ?? FACE_PLACEMENTS[0]!;
    return {
      id,
      width,
      height,
      lungTestUrl: `/balloons/lung-test/${filename}`,
      balloonRushUrl: `/balloons/balloon-rush/${filename}`,
      face: { x: faceX, y: faceY, scale: faceScale },
    };
  },
);

const imageCache = new Map<number, HTMLImageElement>();
let fullResolutionImage: { assetId: number; image: HTMLImageElement } | null = null;

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

export function getFullResolutionBalloonImage(
  assetId: number,
): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const asset = getBalloonAsset(assetId);
  if (fullResolutionImage?.assetId === asset.id) {
    return fullResolutionImage.image;
  }

  const image = new Image();
  image.decoding = 'async';
  image.src = asset.lungTestUrl;
  fullResolutionImage = { assetId: asset.id, image };
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
