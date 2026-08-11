import { describe, expect, it } from 'vitest';
import { BALLOON_ASSETS } from './balloonAssets';
import { createRandomVariant } from './createBalloon';

describe('createRandomVariant', () => {
  it('avoids immediately repeating the same image', () => {
    const values = [0, 0.25];
    let index = 0;
    const random = () => values[index++] ?? 0.5;
    const previous = { assetId: 1, seed: 4 };
    const next = createRandomVariant(previous, random);
    expect(next.assetId).not.toBe(previous.assetId);
    expect(BALLOON_ASSETS.some(({ id }) => id === next.assetId)).toBe(true);
  });
});
