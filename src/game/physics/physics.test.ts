import { describe, expect, it } from 'vitest';
import { createBalloonBody } from '../balloons/createBalloon';
import {
  constrainToBounds,
  resolveBalloonCollision,
} from './physics';

function balloon(seed: number, x: number, y: number) {
  return createBalloonBody(
    { shape: 'round', paletteId: 'coral', seed },
    x,
    y,
    30,
  );
}

describe('balloon physics', () => {
  it('separates overlapping balloons and applies soft compression', () => {
    const first = balloon(1, 50, 50);
    const second = balloon(2, 80, 50);
    const before = Math.hypot(second.x - first.x, second.y - first.y);
    expect(resolveBalloonCollision(first, second)).toBe(true);
    const after = Math.hypot(second.x - first.x, second.y - first.y);
    expect(after).toBeGreaterThan(before);
    expect(first.compressionX).toBeLessThan(1);
    expect(first.compressionY).toBeGreaterThan(1);
  });

  it('keeps balloons inside the screen bounds', () => {
    const body = balloon(3, -20, -20);
    constrainToBounds(body, 320, 640);
    expect(body.x).toBeGreaterThan(0);
    expect(body.y).toBeGreaterThan(0);
  });
});
