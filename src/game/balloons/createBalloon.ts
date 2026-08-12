import type { BalloonBody, BalloonVariant } from '../types';
import { BALLOON_ASSETS, getBalloonAsset } from './balloonAssets';

export const BALLOON_FACE_CHARACTER_COUNT = 5;

export function createRandomVariant(
  previous?: BalloonVariant,
  random: () => number = Math.random,
): BalloonVariant {
  const candidates = previous
    ? BALLOON_ASSETS.filter(({ id }) => id !== previous.assetId)
    : BALLOON_ASSETS;
  const selected =
    candidates[Math.floor(random() * candidates.length)] ?? BALLOON_ASSETS[0]!;

  const faceCandidates = Array.from(
    { length: BALLOON_FACE_CHARACTER_COUNT },
    (_, index) => index,
  ).filter((faceId) => faceId !== previous?.faceId);

  return {
    assetId: selected.id,
    seed: Math.floor(random() * 1_000_000),
    faceId:
      faceCandidates[Math.floor(random() * faceCandidates.length)] ?? 0,
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
    faceId: Math.floor(random() * BALLOON_FACE_CHARACTER_COUNT),
  };
}

export function createBalloonBody(
  variant: BalloonVariant,
  x: number,
  y: number,
  radius = 22,
): BalloonBody {
  return {
    id: `${variant.seed}-${performance.now().toFixed(2)}`,
    variant,
    x,
    y,
    vx: 0,
    vy: 0,
    radiusX: radius,
    // asset 원본의 세로 비율에 따라 충돌 크기가 달라지지 않도록
    // 모든 풍선을 동일한 기준 박스로 처리한다.
    radiusY: radius,
    rotation: 0,
    angularVelocity: 0,
    compressionX: 1,
    compressionY: 1,
    compressionAngle: 0,
    completed: false,
    depth: 1.06,
  };
}
