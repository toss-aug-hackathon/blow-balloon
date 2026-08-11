import { getPalette } from './balloonPalette';
import type { BalloonBody, BalloonShape } from '../types';
import { clamp } from '../../utils/math';

function createShapePath(shape: BalloonShape): Path2D {
  const path = new Path2D();
  if (shape === 'heart') {
    path.moveTo(0, 0.92);
    path.bezierCurveTo(-0.18, 0.62, -1, 0.22, -0.88, -0.38);
    path.bezierCurveTo(-0.78, -0.92, -0.18, -1.02, 0, -0.58);
    path.bezierCurveTo(0.18, -1.02, 0.78, -0.92, 0.88, -0.38);
    path.bezierCurveTo(1, 0.22, 0.18, 0.62, 0, 0.92);
  } else if (shape === 'pear') {
    path.moveTo(0, -1);
    path.bezierCurveTo(-0.52, -0.98, -0.98, -0.36, -0.9, 0.3);
    path.bezierCurveTo(-0.84, 0.82, -0.38, 1.02, 0, 1);
    path.bezierCurveTo(0.38, 1.02, 0.84, 0.82, 0.9, 0.3);
    path.bezierCurveTo(0.98, -0.36, 0.52, -0.98, 0, -1);
  } else {
    path.ellipse(0, 0, 0.94, 1, 0, 0, Math.PI * 2);
  }
  path.closePath();
  return path;
}

export function drawBalloon(
  context: CanvasRenderingContext2D,
  balloon: BalloonBody,
  timeMs: number,
  alpha = 1,
  windStrength = 0,
): void {
  const palette = getPalette(balloon.variant.paletteId);
  const wobble =
    Math.sin(timeMs * 0.0022 + balloon.variant.seed) *
    (balloon.completed ? 0.035 : 0.018) +
    Math.sin(timeMs * 0.006 + balloon.variant.seed) * windStrength * 0.018;
  const radiusX = balloon.radiusX * balloon.depth;
  const radiusY = balloon.radiusY * balloon.depth;
  const depthAlpha = clamp(0.82 + (balloon.depth - 0.94) * 1.5, 0.76, 1);
  const path = createShapePath(balloon.variant.shape);

  context.save();
  context.globalAlpha = alpha * depthAlpha;
  context.translate(balloon.x, balloon.y);
  context.rotate(balloon.rotation + wobble);

  context.save();
  context.rotate(balloon.compressionAngle);
  context.scale(
    radiusX * balloon.compressionX,
    radiusY * balloon.compressionY,
  );
  context.rotate(-balloon.compressionAngle);

  context.shadowColor = 'rgba(51, 30, 40, 0.08)';
  context.shadowBlur = Math.max(3, radiusX * 0.07 * balloon.depth);
  context.shadowOffsetY = Math.max(1, radiusY * 0.025);
  const bodyGradient = context.createRadialGradient(-0.42, -0.5, 0.04, 0.36, 0.42, 1.32);
  bodyGradient.addColorStop(0, palette.light);
  bodyGradient.addColorStop(0.28, palette.base);
  bodyGradient.addColorStop(0.72, palette.base);
  bodyGradient.addColorStop(1, palette.dark);
  context.fillStyle = bodyGradient;
  context.fill(path);
  context.shadowColor = 'transparent';

  context.save();
  context.clip(path);
  const gloss = context.createRadialGradient(
    -0.38,
    -0.42,
    0.02,
    -0.1,
    -0.18,
    0.78,
  );
  gloss.addColorStop(0, 'rgba(255,255,255,0.62)');
  gloss.addColorStop(0.34, 'rgba(255,255,255,0.2)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gloss;
  context.fillRect(-1.2, -1.2, 2.4, 2.4);
  context.restore();
  context.restore();

  // The knot follows the rotated bottom anchor, but the string hangs down
  // with gravity instead of rotating upward with an upside-down balloon.
  const attachmentAngle = balloon.rotation + wobble;
  const knotY = radiusY * balloon.compressionY * 0.95;
  const attachmentX = balloon.x - Math.sin(attachmentAngle) * knotY;
  const attachmentY = balloon.y + Math.cos(attachmentAngle) * knotY;
  context.restore();

  context.save();
  context.translate(attachmentX, attachmentY);

  const stringLength = clamp(radiusY * 0.82, 38, 112);
  context.beginPath();
  context.moveTo(0, 7);
  context.bezierCurveTo(
    7 + wobble * 18,
    stringLength * 0.34,
    -7 + wobble * 12,
    stringLength * 0.68,
    2 + wobble * 8,
    stringLength,
  );
  context.strokeStyle = palette.dark;
  context.globalAlpha = alpha * depthAlpha * 0.78;
  context.lineWidth = Math.max(1.2, Math.min(2.4, radiusX * 0.035));
  context.lineCap = 'round';
  context.stroke();

  context.save();
  context.rotate(attachmentAngle);
  context.beginPath();
  context.moveTo(0, -2);
  context.lineTo(-6, 7);
  context.lineTo(6, 7);
  context.closePath();
  context.fillStyle = palette.dark;
  context.fill();
  context.restore();

  context.restore();
}
