import { describe, expect, it } from 'vitest';
import { createRandomVariant } from './createBalloon';

describe('createRandomVariant', () => {
  it('avoids an immediately repeated shape and palette combination', () => {
    const values = [0, 0, 0.1, 0, 0, 0.2, 0.25, 0.25, 0.3];
    let index = 0;
    const random = () => values[index++] ?? 0.5;
    const previous = { shape: 'round' as const, paletteId: 'coral', seed: 4 };
    const next = createRandomVariant(previous, random);
    expect([next.shape, next.paletteId]).not.toEqual([
      previous.shape,
      previous.paletteId,
    ]);
  });
});
