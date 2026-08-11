import type { BalloonBody } from '../types';
import { clamp } from '../../utils/math';
import {
  getBalloonAsset,
  getBalloonImage,
  getFullResolutionBalloonImage,
} from './balloonAssets';
import {
  drawBalloonFace,
  type BalloonFaceMotion,
} from './drawBalloonFace';

const ASSET_SCALE: Readonly<Record<number, number>> = {
  3: 1.2,
  8: 1.45,
  11: 1.4,
  14: 1.12,
  15: 1.5,
};

export function drawBalloon(
  context: CanvasRenderingContext2D,
  balloon: BalloonBody,
  timeMs: number,
  alpha = 1,
  windStrength = 0,
  faceMotion?: BalloonFaceMotion,
  cachedImage?: CanvasImageSource,
): void {
  const asset = getBalloonAsset(balloon.variant.assetId);
  const thumbnail = getBalloonImage(asset.id);
  const fullResolutionImage = balloon.completed
    ? null
    : getFullResolutionBalloonImage(asset.id);
  const image =
    cachedImage ??
    (fullResolutionImage?.complete && fullResolutionImage.naturalWidth > 0
      ? fullResolutionImage
      : thumbnail);
  if (
    !image ||
    (image instanceof HTMLImageElement &&
      (!image.complete || image.naturalWidth === 0))
  ) {
    return;
  }

  const wobble =
    Math.sin(timeMs * 0.0022 + balloon.variant.seed) *
      (balloon.completed ? 0.022 : 0.012) +
    Math.sin(timeMs * 0.005 + balloon.variant.seed) * windStrength * 0.012;
  const depthAlpha = clamp(0.84 + (balloon.depth - 0.94) * 1.35, 0.8, 1);
  const drawWidth =
    balloon.radiusX * 2 * balloon.depth * (ASSET_SCALE[asset.sourceId] ?? 1);
  const drawHeight = drawWidth * (asset.height / asset.width);
  const bodyTop = -balloon.radiusY * balloon.depth;

  context.save();
  context.globalAlpha = alpha * depthAlpha;
  context.translate(balloon.x, balloon.y);
  context.rotate(balloon.rotation + wobble);
  context.rotate(balloon.compressionAngle);
  context.scale(balloon.compressionX, balloon.compressionY);
  context.rotate(-balloon.compressionAngle);
  context.drawImage(image, -drawWidth / 2, bodyTop, drawWidth, drawHeight);
  if (faceMotion) {
    const faceScale = drawWidth * asset.face.scale;
    context.save();
    // Pull unusual asset anchors slightly toward the visual center. This
    // keeps the character readable on both tall and wide balloon artwork.
    const faceX =
      asset.id === 12 ? 0.5 : asset.face.x * 0.72 + 0.5 * 0.28;
    const flowerLift = asset.id === 9 ? -0.055 : 0;
    const faceY = asset.face.y * 0.82 + 0.34 * 0.18 + flowerLift;
    context.translate((faceX - 0.5) * drawWidth, bodyTop + faceY * drawHeight);
    context.scale(faceScale, faceScale);
    context.beginPath();
    context.ellipse(0, 0, 0.58, 0.52, 0, 0, Math.PI * 2);
    context.clip();
    drawBalloonFace(
      context,
      timeMs,
      balloon.variant.seed,
      balloon.variant.faceId ?? balloon.variant.seed % 5,
      faceMotion,
    );
    context.restore();
  }
  context.restore();
}
