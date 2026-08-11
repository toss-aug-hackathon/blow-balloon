import { describe, expect, it } from 'vitest';
import { getBalloonFacePose } from './drawBalloonFace';

describe('getBalloonFacePose', () => {
  it('moves from surprise to strain and then relief', () => {
    const surprised = getBalloonFacePose(0.4, 0);
    const strained = getBalloonFacePose(1, 0);
    const relieved = getBalloonFacePose(1, 1);

    expect(surprised.eyeOpen).toBeGreaterThan(strained.eyeOpen);
    expect(strained.strain).toBe(1);
    expect(relieved.relief).toBe(1);
    expect(relieved.mouthOpen).toBe(0);
  });
});
