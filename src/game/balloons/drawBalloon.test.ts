import { describe, expect, it } from 'vitest';
import { getBalloonFacePose } from './drawBalloonFace';

describe('getBalloonFacePose', () => {
  it('moves from surprise to strain and then relief without jumps', () => {
    const surprised = getBalloonFacePose(0.34, 0);
    const strained = getBalloonFacePose(0.7, 0);
    const sweating = getBalloonFacePose(0.8, 0);
    const squeezed = getBalloonFacePose(0.96, 0);
    const relieved = getBalloonFacePose(1, 1);

    expect(surprised.eyeOpen).toBeGreaterThan(strained.eyeOpen);
    expect(strained.strain).toBe(1);
    expect(sweating.squeeze).toBe(0);
    expect(squeezed.squeeze).toBeGreaterThan(0.9);
    expect(relieved.relief).toBe(1);
    expect(relieved.mouthOpen).toBe(0);
  });
});
