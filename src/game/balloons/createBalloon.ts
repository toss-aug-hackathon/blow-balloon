import type { BalloonBody, BalloonVariant } from '../types';
import { BALLOON_ASSETS, getBalloonAsset } from './balloonAssets';

export function createRandomVariant(
  previous?: BalloonVariant,
  random: () => number = Math.random,
): BalloonVariant {
  const candidates = previous
    ? BALLOON_ASSETS.filter(({ id }) => id !== previous.assetId)
    : BALLOON_ASSETS;
  const selected =
    candidates[Math.floor(random() * candidates.length)] ?? BALLOON_ASSETS[0]!;

  return {
    assetId: selected.id,
    seed: Math.floor(random() * 1_000_000),
  };
}

export function createVariantForAsset(
  assetId: number,
  random: () => number = Math.random,
): BalloonVariant {
  const asset = getBalloonAsset(assetId);
  return {
    assetId: asset.id,
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
    depth: 1.06,
  };
}
