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

export function drawBalloon(
  context: CanvasRenderingContext2D,
  balloon: BalloonBody,
  timeMs: number,
  alpha = 1,
  windStrength = 0,
  faceMotion?: BalloonFaceMotion,
): void {
  const asset = getBalloonAsset(balloon.variant.assetId);
  const thumbnail = getBalloonImage(asset.id);
  const fullResolutionImage = balloon.completed
    ? null
    : getFullResolutionBalloonImage(asset.id);
  const image =
    fullResolutionImage?.complete && fullResolutionImage.naturalWidth > 0
      ? fullResolutionImage
      : thumbnail;
  if (!image?.complete || image.naturalWidth === 0) return;

  const wobble =
    Math.sin(timeMs * 0.0022 + balloon.variant.seed) *
      (balloon.completed ? 0.022 : 0.012) +
    Math.sin(timeMs * 0.005 + balloon.variant.seed) * windStrength * 0.012;
  const depthAlpha = clamp(0.84 + (balloon.depth - 0.94) * 1.35, 0.8, 1);
  const drawWidth = balloon.radiusX * 2 * balloon.depth;
  const drawHeight = drawWidth * (asset.height / asset.width);
  const bodyTop = -balloon.radiusY * balloon.depth;

  context.save();
  context.globalAlpha = alpha * depthAlpha;
  context.translate(balloon.x, balloon.y);
  context.rotate(balloon.rotation + wobble);
  context.rotate(balloon.compressionAngle);
  context.scale(balloon.compressionX, balloon.compressionY);
  context.rotate(-balloon.compressionAngle);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const softening = balloon.completed
    ? 0
    : clamp((drawWidth - 150) / 700, 0, 0.42);
  if (softening > 0) context.filter = `blur(${softening}px)`;
  context.drawImage(image, -drawWidth / 2, bodyTop, drawWidth, drawHeight);
  context.filter = 'none';
  if (faceMotion) {
    const faceScale = drawWidth * 0.62;
    context.save();
    context.translate(0, bodyTop + drawWidth * 0.58);
    context.scale(faceScale, faceScale);
    drawBalloonFace(context, timeMs, balloon.variant.seed, faceMotion);
    context.restore();
  }
  context.restore();
}
