import { describe, expect, it } from 'vitest';
import { BlowDetector } from './blowDetector';

function createDetector() {
  const detector = new BlowDetector({
    startHoldMs: 100,
    endGraceMs: 350,
    smoothingFactor: 1,
    minimumStartThreshold: 0.018,
    minimumEndThreshold: 0.012,
    baselineStartMultiplier: 3,
    baselineEndMultiplier: 2,
    normalizationRangeMultiplier: 10,
  });
  detector.setBaseline([0.005, 0.005, 0.006, 0.005]);
  return detector;
}

describe('BlowDetector', () => {
  it('ignores a spike shorter than the start hold time', () => {
    const detector = createDetector();
    expect(detector.update(0.04, 0).state).toBe('candidate');
    expect(detector.update(0.005, 50).state).toBe('idle');
  });

  it('uses calibrated RMS when spectrum data is weak', () => {
    const detector = createDetector();
    expect(detector.update(0.08, 0, 0.08).state).toBe('candidate');
    expect(detector.update(0.08, 200, 0.08).state).toBe('blowing');
  });

  it('starts after a sustained signal and tolerates a short gap', () => {
    const detector = createDetector();
    detector.update(0.04, 0);
    expect(detector.update(0.04, 100).state).toBe('blowing');
    expect(detector.update(0.005, 160).state).toBe('ending');
    const recovered = detector.update(0.04, 380);
    expect(recovered.state).toBe('blowing');
    expect(recovered.isBlowing).toBe(true);
  });

  it('ends only after the 350ms grace period', () => {
    const detector = createDetector();
    detector.update(0.04, 0);
    detector.update(0.04, 100);
    detector.update(0.005, 200);
    expect(detector.update(0.005, 549).isBlowing).toBe(true);
    expect(detector.update(0.005, 550).state).toBe('idle');
  });
});
