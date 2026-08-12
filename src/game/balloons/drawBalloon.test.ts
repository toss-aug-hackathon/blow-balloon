import { describe, expect, it } from 'vitest';
import { drawBalloonFace, getBalloonFacePose } from './drawBalloonFace';

describe('getBalloonFacePose', () => {
  it('moves from surprise to strain and then relief without jumps', () => {
    const surprised = getBalloonFacePose(0.5, 0);
    const strained = getBalloonFacePose(0.7, 0);
    const sweating = getBalloonFacePose(0.78, 0);
    const squeezed = getBalloonFacePose(0.9, 0);
    const relieved = getBalloonFacePose(1, 1);

    expect(surprised.eyeOpen).toBeGreaterThan(strained.eyeOpen);
    expect(strained.strain).toBe(1);
    expect(sweating.squeeze).toBe(0);
    expect(squeezed.squeeze).toBeGreaterThan(0.9);
    expect(relieved.relief).toBe(1);
    expect(relieved.mouthOpen).toBe(0);
  });
});

describe('drawBalloonFace character rendering', () => {
  const createMockContext = () => {
    const context: Record<string, unknown> = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      bezierCurveTo: () => {},
      ellipse: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'round',
    };
    return context as unknown as CanvasRenderingContext2D;
  };

  it('renders all 5 balloon characters across idle, inflation, strain, and relief without throwing', () => {
    const mockCtx = createMockContext();
    const characters = [0, 1, 2, 3, 4] as const;
    const progressLevels = [
      { growthProgress: 0, windStrength: 0, settlingProgress: 0 },
      { growthProgress: 0.3, windStrength: 0.4, settlingProgress: 0 },
      { growthProgress: 0.6, windStrength: 0.7, settlingProgress: 0 },
      { growthProgress: 0.95, windStrength: 1.0, settlingProgress: 0 },
      { growthProgress: 1.0, windStrength: 0, settlingProgress: 1.0 },
    ];

    for (const charId of characters) {
      for (const motion of progressLevels) {
        expect(() => {
          drawBalloonFace(mockCtx, 1000, 12345, charId, motion);
        }).not.toThrow();
      }
    }
  });
});

