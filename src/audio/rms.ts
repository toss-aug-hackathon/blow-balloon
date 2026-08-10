import { clamp } from '../utils/math';

export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;

  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0;
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples.length);
}

export function normalizeWindStrength(
  rms: number,
  baseline: number,
  startThreshold: number,
  rangeMultiplier: number,
): number {
  const usableRange = Math.max(startThreshold, baseline * rangeMultiplier);
  return clamp((rms - baseline) / usableRange, 0, 1);
}
