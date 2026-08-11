export type BalloonAsset = {
  id: number;
  width: number;
  height: number;
  url: string;
  fullResolutionUrl: string;
};

const DIMENSIONS: ReadonlyArray<readonly [number, number]> = [
  [6069, 9589], [7172, 9589], [5294, 9589], [7027, 9589], [3614, 10541],
  [5346, 9775], [3895, 10341], [5004, 9589], [5631, 7976],
  [3991, 9853], [5921, 8939], [5921, 7831], [4914, 8359], [4914, 8359],
  [4914, 8649], [4432, 8649], [4145, 9250], [5590, 8396], [6266, 8951],
  [6266, 8951], [6266, 8951], [5207, 8614], [8243, 8559], [6556, 9186],
  [4917, 8872], [6406, 8376], [8434, 8086], [6847, 6977], [6484, 8176],
  [5544, 9859], [5683, 8269], [6165, 8733], [4313, 9029], [5329, 9444],
  [6429, 9099],
];

export const BALLOON_ASSETS: readonly BalloonAsset[] = DIMENSIONS.map(
  ([width, height], index) => {
    const id = index + 1;
    const filename = `balloon_${String(id).padStart(2, '0')}.png`;
    return {
      id,
      width,
      height,
      url: `/balloons/${filename}`,
      fullResolutionUrl: `/balloons/full/${filename}`,
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
  image.src = asset.url;
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
  image.src = asset.fullResolutionUrl;
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
