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

  it('keeps every face placement inside its asset', () => {
    for (const asset of BALLOON_ASSETS) {
      expect(asset.face.x).toBeGreaterThan(0);
      expect(asset.face.x).toBeLessThan(1);
      expect(asset.face.y).toBeGreaterThan(0);
      expect(asset.face.y).toBeLessThan(1);
      expect(asset.face.scale).toBeGreaterThan(0);
      expect(asset.face.scale).toBeLessThanOrEqual(0.52);
    }
  });
});
