import { clamp, lerp } from '../../utils/math';
import type { BalloonBody } from '../types';
import { getBalloonAsset } from '../balloons/balloonAssets';

const COLLISION_RADIUS_FACTOR_BY_ASSET: Readonly<Record<number, number>> = {
  1: 1.04,
  2: 1.00,
  3: 0.98,
  4: 1.08,
  5: 1.08,
  6: 1.02,
  7: 1.08,
  8: 1.04,
  9: 0.98,
  10: 1.00,
  11: 1.12,
  12: 1.04,
  13: 0.98,
  14: 1.04,
  15: 0.98,
};

function getVisualTopExtent(balloon: BalloonBody): number {
  const asset = getBalloonAsset(balloon.variant.assetId);
  const bodySize = Math.min(balloon.radiusX, balloon.radiusY) * 3.1 * balloon.depth;
  const fitScale = Math.min(bodySize / asset.width, bodySize / asset.height);
  return (asset.height * fitScale) / 2;
}

function getCollisionRadius(balloon: BalloonBody): number {
  const factor = COLLISION_RADIUS_FACTOR_BY_ASSET[balloon.variant.assetId] ?? 1;
  return ((balloon.radiusX + balloon.radiusY) * 0.46) * factor;
}

export function constrainToBounds(
  balloon: BalloonBody,
  width: number,
  height: number,
  topInset = 0,
): void {
  const radiusX = balloon.radiusX * 0.86;
  const radiusY = balloon.radiusY * 0.86;
  if (balloon.x - radiusX < 0) {
    balloon.x = radiusX;
    balloon.vx = Math.abs(balloon.vx) * 0.32;
  } else if (balloon.x + radiusX > width) {
    balloon.x = width - radiusX;
    balloon.vx = -Math.abs(balloon.vx) * 0.32;
  }
  const visualTopExtent = Math.max(radiusY, getVisualTopExtent(balloon));
  if (balloon.y - visualTopExtent < topInset) {
    balloon.y = topInset + visualTopExtent;
    balloon.vy = Math.abs(balloon.vy) * 0.18;
  }
  if (balloon.y + radiusY > height) {
    balloon.y = height - radiusY;
    balloon.vy = -Math.abs(balloon.vy) * 0.2;
  }
}

export function resolveBalloonCollision(
  first: BalloonBody,
  second: BalloonBody,
): boolean {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const distance = Math.hypot(dx, dy) || 0.001;
  const firstRadius = getCollisionRadius(first);
  const secondRadius = getCollisionRadius(second);
  const minimumDistance = firstRadius + secondRadius;
  if (distance >= minimumDistance) return false;

  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minimumDistance - distance;
  const correction = overlap * 0.48;
  first.x -= nx * correction;
  first.y -= ny * correction;
  second.x += nx * correction;
  second.y += ny * correction;

  const relativeVelocity =
    (second.vx - first.vx) * nx + (second.vy - first.vy) * ny;
  if (relativeVelocity < 0) {
    const impulse = relativeVelocity * 0.18;
    first.vx += nx * impulse;
    first.vy += ny * impulse;
    second.vx -= nx * impulse;
    second.vy -= ny * impulse;
  }

  const pressure = clamp(overlap / minimumDistance, 0, 0.18);
  const squash = Math.max(0.82, 1 - pressure * 1.3);
  const stretch = Math.min(1.1, 1 + pressure * 0.65);
  first.compressionX = Math.min(first.compressionX, squash);
  first.compressionY = Math.max(first.compressionY, stretch);
  first.compressionAngle = Math.atan2(ny, nx);
  second.compressionX = Math.min(second.compressionX, squash);
  second.compressionY = Math.max(second.compressionY, stretch);
  second.compressionAngle = Math.atan2(ny, nx);
  return true;
}

export function updateHeliumPhysics(
  balloons: BalloonBody[],
  deltaSeconds: number,
  width: number,
  height: number,
  topInset = 0,
): void {
  const maxHorizontalSpeed = 10;
  const heliumBuoyancy = 28;
  const maxVerticalSpeed = 34;
  for (const balloon of balloons) {
    balloon.compressionX = lerp(balloon.compressionX, 1, 0.12);
    balloon.compressionY = lerp(balloon.compressionY, 1, 0.12);
    balloon.vy -= heliumBuoyancy * deltaSeconds;
    balloon.vx +=
      Math.sin(balloon.variant.seed + balloon.y * 0.015) *
      (4 + balloon.depth * 2.5) *
      deltaSeconds;
    balloon.vx = clamp(balloon.vx, -maxHorizontalSpeed, maxHorizontalSpeed);
    balloon.vy = clamp(balloon.vy, -maxVerticalSpeed, maxVerticalSpeed);
    balloon.vx *= Math.pow(0.986, deltaSeconds * 60);
    balloon.vy *= Math.pow(0.986, deltaSeconds * 60);
    balloon.x += balloon.vx * deltaSeconds;
    balloon.y += balloon.vy * deltaSeconds;
    balloon.rotation += balloon.angularVelocity * deltaSeconds;
    balloon.angularVelocity *= Math.pow(0.98, deltaSeconds * 60);
    constrainToBounds(balloon, width, height, topInset);
  }

  const cellSize = 140;
  const neighborOffsets = [
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ] as const;
  for (let pass = 0; pass < 2; pass += 1) {
    const cells = new Map<string, BalloonBody[]>();
    for (const balloon of balloons) {
      const key = `${Math.floor(balloon.x / cellSize)},${Math.floor(
        balloon.y / cellSize,
      )}`;
      const cell = cells.get(key);
      if (cell) cell.push(balloon);
      else cells.set(key, [balloon]);
    }
    for (const [key, cell] of cells) {
      const [cellX, cellY] = key.split(',').map(Number);
      for (let firstIndex = 0; firstIndex < cell.length; firstIndex += 1) {
        for (
          let secondIndex = firstIndex + 1;
          secondIndex < cell.length;
          secondIndex += 1
        ) {
          resolveBalloonCollision(cell[firstIndex]!, cell[secondIndex]!);
        }
      }
      for (const [offsetX, offsetY] of neighborOffsets) {
        const neighbor = cells.get(`${cellX! + offsetX},${cellY! + offsetY}`);
        if (!neighbor) continue;
        for (const first of cell) {
          for (const second of neighbor) resolveBalloonCollision(first, second);
        }
      }
    }
    balloons.forEach((balloon) =>
      constrainToBounds(balloon, width, height, topInset),
    );
  }
}
