export const BLOW_CONFIG = {
  calibrationMs: 850,
  startHoldMs: 100,
  endGraceMs: 350,
  smoothingFactor: 0.18,
  minimumStartThreshold: 0.018,
  minimumEndThreshold: 0.012,
  baselineStartMultiplier: 3.2,
  baselineEndMultiplier: 2.1,
  normalizationRangeMultiplier: 10,
  minimumBreathiness: 0.18,
  uiUpdateIntervalMs: 50,
} as const;
