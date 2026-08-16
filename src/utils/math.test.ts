import { describe, expect, it } from 'vitest';
import { getContainScale } from './math';

describe('getContainScale', () => {
  it('fits content without enlarging it', () => {
    expect(getContainScale(360, 600, 360, 750)).toBe(0.8);
    expect(getContainScale(400, 800, 360, 750)).toBe(1);
  });
});
