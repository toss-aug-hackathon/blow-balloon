import type { BalloonBody } from '../types';
import { clamp } from '../../utils/math';
import { getBalloonAsset, getBalloonImage } from './balloonAssets';

export function drawBalloon(
  context: CanvasRenderingContext2D,
  balloon: BalloonBody,
  timeMs: number,
  alpha = 1,
  windStrength = 0,
): void {
  const asset = getBalloonAsset(balloon.variant.assetId);
  const image = getBalloonImage(asset.id);
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
  context.drawImage(image, -drawWidth / 2, bodyTop, drawWidth, drawHeight);
  context.restore();
}
