import type { BalloonBody, BalloonVariant } from '../types';
import { BALLOON_ASSETS, getBalloonAsset } from './balloonAssets';

export function createRandomVariant(
  previous?: BalloonVariant,
  random: () => number = Math.random,
): BalloonVariant {
  const assetId = previous
    ? ((previous.assetId + Math.floor(random() * (BALLOON_ASSETS.length - 1))) %
        BALLOON_ASSETS.length) +
      1
    : Math.floor(random() * BALLOON_ASSETS.length) + 1;

  return {
    assetId,
    seed: Math.floor(random() * 1_000_000),
  };
}

export function createBalloonBody(
  variant: BalloonVariant,
  x: number,
  y: number,
  radius = 22,
): BalloonBody {
  const asset = getBalloonAsset(variant.assetId);
  const bodyAspect = Math.min(
    1.55,
    Math.max(0.82, (asset.height / asset.width) * 0.67),
  );
  return {
    id: `${variant.seed}-${performance.now().toFixed(2)}`,
    variant,
    x,
    y,
    vx: 0,
    vy: 0,
    radiusX: radius,
    radiusY: radius * bodyAspect,
    rotation: 0,
    angularVelocity: 0,
    compressionX: 1,
    compressionY: 1,
    compressionAngle: 0,
    completed: false,
    depth: 0.94 + Math.random() * 0.12,
  };
}
