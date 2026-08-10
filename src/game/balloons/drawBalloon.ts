import { getPalette } from './balloonPalette';
import type { BalloonBody, BalloonShape } from '../types';

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
): void {
  const palette = getPalette(balloon.variant.paletteId);
  const wobble =
    Math.sin(timeMs * 0.0022 + balloon.variant.seed) *
    (balloon.completed ? 0.035 : 0.018);
  const radiusX = balloon.radiusX * balloon.depth;
  const radiusY = balloon.radiusY * balloon.depth;
  const path = createShapePath(balloon.variant.shape);

  context.save();
  context.globalAlpha = alpha;
  context.translate(balloon.x, balloon.y);
  context.rotate(balloon.rotation + wobble);

  context.save();
  context.rotate(balloon.compressionAngle);
  context.scale(
    radiusX * balloon.compressionX,
    radiusY * balloon.compressionY,
  );
  context.rotate(-balloon.compressionAngle);

  context.shadowColor = 'rgba(81, 46, 61, 0.22)';
  context.shadowBlur = Math.max(5, radiusX * 0.18);
  context.shadowOffsetY = Math.max(3, radiusY * 0.08);
  const bodyGradient = context.createRadialGradient(
    -0.34,
    -0.45,
    0.08,
    0.1,
    0.05,
    1.18,
  );
  bodyGradient.addColorStop(0, palette.light);
  bodyGradient.addColorStop(0.3, palette.base);
  bodyGradient.addColorStop(0.78, palette.base);
  bodyGradient.addColorStop(1, palette.dark);
  context.fillStyle = bodyGradient;
  context.fill(path);
  context.shadowColor = 'transparent';

  context.save();
  context.clip(path);
  const edge = context.createLinearGradient(-1, -0.2, 1, 0.5);
  edge.addColorStop(0, 'rgba(255,255,255,0.14)');
  edge.addColorStop(0.55, 'rgba(255,255,255,0)');
  edge.addColorStop(1, 'rgba(75,20,60,0.25)');
  context.fillStyle = edge;
  context.fillRect(-1.2, -1.2, 2.4, 2.4);

  context.beginPath();
  context.ellipse(-0.35, -0.43, 0.13, 0.3, -0.45, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255,255,255,0.54)';
  context.fill();
  context.beginPath();
  context.ellipse(-0.24, -0.7, 0.055, 0.1, -0.4, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255,255,255,0.72)';
  context.fill();
  context.restore();
  context.restore();

  const knotY = radiusY * balloon.compressionY * 0.94;
  if (balloon.completed) {
    context.beginPath();
    context.moveTo(0, knotY + 7);
    context.bezierCurveTo(
      8,
      knotY + 22,
      -7,
      knotY + 36,
      2,
      knotY + 50,
    );
    context.strokeStyle = 'rgba(93,72,83,0.4)';
    context.lineWidth = 1.2;
    context.stroke();
  }
  context.beginPath();
  context.moveTo(0, knotY - 1);
  context.lineTo(-6, knotY + 9);
  context.lineTo(6, knotY + 9);
  context.closePath();
  context.fillStyle = palette.dark;
  context.fill();
  context.restore();
}
