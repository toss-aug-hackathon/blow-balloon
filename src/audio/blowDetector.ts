import { BLOW_CONFIG } from './blowConfig';
import { normalizeWindStrength } from './rms';

export type BlowState = 'idle' | 'candidate' | 'blowing' | 'ending';

export type DetectorFrame = {
  rawRms: number;
  baselineRms: number;
  windStrength: number;
  isBlowing: boolean;
  state: BlowState;
  currentBreathDurationMs: number;
};

type DetectorOptions = {
  startHoldMs: number;
  endGraceMs: number;
  smoothingFactor: number;
  minimumStartThreshold: number;
  minimumEndThreshold: number;
  baselineStartMultiplier: number;
  baselineEndMultiplier: number;
  normalizationRangeMultiplier: number;
};

const DEFAULT_OPTIONS: DetectorOptions = {
  startHoldMs: BLOW_CONFIG.startHoldMs,
  endGraceMs: BLOW_CONFIG.endGraceMs,
  smoothingFactor: BLOW_CONFIG.smoothingFactor,
  minimumStartThreshold: BLOW_CONFIG.minimumStartThreshold,
  minimumEndThreshold: BLOW_CONFIG.minimumEndThreshold,
  baselineStartMultiplier: BLOW_CONFIG.baselineStartMultiplier,
  baselineEndMultiplier: BLOW_CONFIG.baselineEndMultiplier,
  normalizationRangeMultiplier: BLOW_CONFIG.normalizationRangeMultiplier,
};

export class BlowDetector {
  private state: BlowState = 'idle';
  private baseline = 0.006;
  private smoothedWind = 0;
  private candidateStartedAt: number | null = null;
  private breathStartedAt: number | null = null;
  private endingStartedAt: number | null = null;

  constructor(private readonly options: DetectorOptions = DEFAULT_OPTIONS) {}

  setBaseline(samples: number[]): number {
    if (samples.length === 0) {
      throw new Error('주변 소음을 측정하지 못했어요.');
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const upperIndex = Math.max(0, Math.floor(sorted.length * 0.8) - 1);
    const usefulSamples = sorted.slice(0, upperIndex + 1);
    this.baseline =
      usefulSamples.reduce((sum, sample) => sum + sample, 0) /
      usefulSamples.length;
    this.reset();
    return this.baseline;
  }

  reset(): void {
    this.state = 'idle';
    this.smoothedWind = 0;
    this.candidateStartedAt = null;
    this.breathStartedAt = null;
    this.endingStartedAt = null;
  }

  update(rawRms: number, nowMs: number): DetectorFrame {
    const startThreshold = Math.max(
      this.options.minimumStartThreshold,
      this.baseline * this.options.baselineStartMultiplier,
    );
    const endThreshold = Math.max(
      this.options.minimumEndThreshold,
      this.baseline * this.options.baselineEndMultiplier,
    );
    const normalized = normalizeWindStrength(
      rawRms,
      this.baseline,
      startThreshold,
      this.options.normalizationRangeMultiplier,
    );
    this.smoothedWind +=
      (normalized - this.smoothedWind) * this.options.smoothingFactor;

    if (this.state === 'idle') {
      if (rawRms >= startThreshold) {
        this.state = 'candidate';
        this.candidateStartedAt = nowMs;
      }
    } else if (this.state === 'candidate') {
      if (rawRms < startThreshold) {
        this.state = 'idle';
        this.candidateStartedAt = null;
      } else if (
        this.candidateStartedAt !== null &&
        nowMs - this.candidateStartedAt >= this.options.startHoldMs
      ) {
        this.state = 'blowing';
        this.breathStartedAt = this.candidateStartedAt;
        this.endingStartedAt = null;
      }
    } else if (this.state === 'blowing') {
      if (rawRms < endThreshold) {
        this.state = 'ending';
        this.endingStartedAt = nowMs;
      }
    } else if (rawRms >= endThreshold) {
      this.state = 'blowing';
      this.endingStartedAt = null;
    } else if (
      this.endingStartedAt !== null &&
      nowMs - this.endingStartedAt >= this.options.endGraceMs
    ) {
      this.state = 'idle';
      this.candidateStartedAt = null;
      this.breathStartedAt = null;
      this.endingStartedAt = null;
    }

    const isBlowing = this.state === 'blowing' || this.state === 'ending';
    return {
      rawRms,
      baselineRms: this.baseline,
      windStrength: isBlowing ? this.smoothedWind : 0,
      isBlowing,
      state: this.state,
      currentBreathDurationMs:
        isBlowing && this.breathStartedAt !== null
          ? Math.max(0, nowMs - this.breathStartedAt)
          : 0,
    };
  }
}
