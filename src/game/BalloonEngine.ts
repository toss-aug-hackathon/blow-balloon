import type { DetectorFrame } from '../audio/blowDetector';
import { clamp } from '../utils/math';
import {
  createBalloonBody,
  createRandomVariant,
  createVariantForAsset,
} from './balloons/createBalloon';
import { getBalloonAsset, getBalloonImage } from './balloons/balloonAssets';
import { drawBalloon } from './balloons/drawBalloon';
import { APP_THEME } from '../styles/theme';
import { updateHeliumPhysics } from './physics/physics';
import {
  BALLOON_RUSH_DURATION_MS,
  LUNG_MAX_GROWTH_DURATION_MS,
  MAX_RUSH_BALLOON_COUNT,
  RUSH_MAX_RADIUS,
  calculateAverageWind,
  calculateBalloonScore,
  calculateWindGrowthMultiplier,
  hasRushTimeExpired,
  isBalloonComplete,
} from './rules';
import type {
  BalloonBody,
  GameHudState,
  GameMode,
  GameResult,
} from './types';

type BalloonEngineOptions = {
  mode: GameMode;
  initialBalloonId?: number;
  context: CanvasRenderingContext2D;
  onHudChange: (hud: GameHudState) => void;
  onFinish: (result: GameResult) => void;
};

// The active balloon starts behind the bottom wind panel and reveals itself
// as it grows into the playfield.
const ACTIVE_BALLOON_TARGET_RATIO = 0.82;
const LUNG_ACTIVE_BALLOON_CENTER_Y_RATIO = 0.43;
const RUSH_SPAWN_LANES = [0.24, 0.5, 0.76] as const;
export class BalloonEngine {
  private readonly mode: GameMode;
  private readonly context: CanvasRenderingContext2D;
  private readonly onHudChange: (hud: GameHudState) => void;
  private readonly onFinish: (result: GameResult) => void;
  private width = 1;
  private height = 1;
  private activeBalloon: BalloonBody;
  private completedBalloons: BalloonBody[] = [];
  private previousFrameTime: number | null = null;
  private elapsedMs = 0;
  private totalBlowingMs = 0;
  private lastCompletionElapsedMs: number | null = null;
  private windIntegral = 0;
  private peakWind = 0;
  private lungBreathStarted = false;
  private lungSettlingMs = 0;
  private finished = false;
  private paused = false;
  private hudAccumulatorMs = 0;
  private safeTopInset = 0;
  private playBottomInset = 300;
  private background: CanvasGradient | null = null;
  private readonly completedImageCache = new Map<number, HTMLCanvasElement>();
  private activeSpawnXRatio = 0.5;
  private hasChosenInitialSpawn = false;

  constructor(options: BalloonEngineOptions) {
    this.mode = options.mode;
    this.context = options.context;
    this.onHudChange = options.onHudChange;
    this.onFinish = options.onFinish;
    const initialVariant = options.initialBalloonId
      ? createVariantForAsset(options.initialBalloonId)
      : createRandomVariant();
    this.activeBalloon = createBalloonBody(initialVariant, 0, 0);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.background = this.context.createLinearGradient(0, 0, 0, height);
    this.background.addColorStop(0, APP_THEME.paper);
    this.background.addColorStop(0.52, APP_THEME.paper);
    this.background.addColorStop(1, APP_THEME.paperDeep);
    if (!this.lungBreathStarted && this.completedBalloons.length === 0) {
      this.positionActiveBalloon();
    } else {
      this.positionActiveBalloon();
      this.activeBalloon.x = clamp(
        this.activeBalloon.x,
        this.activeBalloon.radiusX,
        width - this.activeBalloon.radiusX,
      );
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.previousFrameTime = null;
  }

  setSafeTopInset(topInset: number): void {
    this.safeTopInset = Math.max(0, topInset);
  }

  setPlayBottomInset(bottomInset: number): void {
    this.playBottomInset = Math.max(0, bottomInset);
  }

  hasStartedLungBreath(): boolean {
    return this.lungBreathStarted;
  }

  dispose(): void {
    for (const image of this.completedImageCache.values()) {
      image.width = 0;
      image.height = 0;
    }
    this.completedImageCache.clear();
    this.completedBalloons.length = 0;
    this.background = null;
  }

  update(timeMs: number, signal: DetectorFrame): void {
    if (this.finished) return;
    if (this.previousFrameTime === null) {
      this.previousFrameTime = timeMs;
      this.draw(timeMs, signal.windStrength);
      return;
    }
    const deltaMs = Math.min(34, Math.max(0, timeMs - this.previousFrameTime));
    this.previousFrameTime = timeMs;
    if (this.paused) {
      this.draw(timeMs, 0);
      return;
    }
    const deltaSeconds = deltaMs / 1000;

    if (this.mode === 'lung-test') {
      this.updateLungTest(deltaMs, deltaSeconds, signal);
    } else {
      this.updateRush(deltaMs, deltaSeconds, signal);
    }
    updateHeliumPhysics(
      this.completedBalloons,
      deltaSeconds,
      this.width,
      this.height,
      this.safeTopInset,
    );
    this.draw(timeMs, signal.windStrength);
    this.publishHud(deltaMs, signal);
  }

  private updateLungTest(
    deltaMs: number,
    deltaSeconds: number,
    signal: DetectorFrame,
  ): void {
    if (this.lungSettlingMs > 0) {
      this.lungSettlingMs += deltaMs;
      this.activeBalloon.compressionX =
        1 + Math.sin(this.lungSettlingMs * 0.025) * 0.035;
      this.activeBalloon.compressionY =
        1 - Math.sin(this.lungSettlingMs * 0.025) * 0.025;
      if (this.lungSettlingMs >= 700) this.finishLungTest();
      return;
    }

    if (signal.state === 'blowing' && signal.hasStrongSignal) {
      this.lungBreathStarted = true;
      this.elapsedMs += deltaMs;
      this.totalBlowingMs += deltaMs;
      this.windIntegral += signal.windStrength * deltaMs;
      this.peakWind = Math.max(this.peakWind, signal.windStrength);
      const maximumRadius = this.getMaximumActiveRadius();
      const growthPerSecond =
        Math.max(1, maximumRadius - 22) /
        (LUNG_MAX_GROWTH_DURATION_MS / 1000);
      const growth =
        growthPerSecond *
        calculateWindGrowthMultiplier(signal.windStrength) *
        deltaSeconds;
      this.growActiveBalloon(growth);
    } else if (this.lungBreathStarted) {
      this.lungSettlingMs = 1;
    }
  }

  private updateRush(
    deltaMs: number,
    deltaSeconds: number,
    signal: DetectorFrame,
  ): void {
    this.elapsedMs += deltaMs;
    if (signal.isBlowing) {
      this.totalBlowingMs += deltaMs;
      const growth =
        37 * calculateWindGrowthMultiplier(signal.windStrength) * deltaSeconds;
      this.growActiveBalloon(growth);
      if (
        this.completedBalloons.length < MAX_RUSH_BALLOON_COUNT &&
        isBalloonComplete(this.averageRadius(this.activeBalloon))
      ) {
        this.completeActiveBalloon();
      }
    }
    if (hasRushTimeExpired(this.elapsedMs)) {
      this.elapsedMs = BALLOON_RUSH_DURATION_MS;
      this.finishRush();
    }
  }

  private growActiveBalloon(amount: number): void {
    const currentRadius = this.averageRadius(this.activeBalloon);
    const maximumRadius = this.getMaximumActiveRadius();
    if (currentRadius >= maximumRadius) return;
    const factor = 1 + Math.min(amount, maximumRadius - currentRadius) / currentRadius;
    this.activeBalloon.radiusX *= factor;
    this.activeBalloon.radiusY *= factor;
    this.positionActiveBalloon();
  }

  private completeActiveBalloon(): void {
    this.activeBalloon.completed = true;
    this.activeBalloon.vx = (Math.random() - 0.5) * 8;
    this.activeBalloon.vy = -8 - Math.random() * 8;
    this.activeBalloon.angularVelocity = (Math.random() - 0.5) * 0.2;
    this.completedBalloons.push(this.activeBalloon);
    this.lastCompletionElapsedMs = this.elapsedMs;
    const variant = createRandomVariant(this.activeBalloon.variant);
    this.activeBalloon = createBalloonBody(variant, 0, 0, 19);
    this.activeSpawnXRatio = this.chooseSpawnXRatio();
    this.positionActiveBalloon();
  }

  private positionActiveBalloon(): void {
    if (!this.hasChosenInitialSpawn) {
      this.activeSpawnXRatio = this.chooseSpawnXRatio();
      this.hasChosenInitialSpawn = true;
    }

    const baseRadius = 22;
    const baseAverageRadius = this.getBaseAverageRadius(baseRadius);
    const maximumRadius = this.getMaximumActiveRadius();
    const progress = clamp(
      (this.averageRadius(this.activeBalloon) - baseAverageRadius) /
        Math.max(1, maximumRadius - baseAverageRadius),
      0,
      1,
    );
    const playHeight = this.getPlayHeight();
    if (this.mode === 'lung-test') {
      const targetY =
        this.height * LUNG_ACTIVE_BALLOON_CENTER_Y_RATIO;
      this.activeBalloon.x = this.width * 0.5;
      this.activeBalloon.y = targetY;
      return;
    }

    // The rush panel covers the lower part of the canvas, so spawn the next
    // balloon just above its top edge rather than underneath it.
    const panelTopStartY =
      playHeight - this.activeBalloon.radiusY - 14;
    const upwardLift = playHeight * 0.13 * progress;
    const targetY =
      playHeight * ACTIVE_BALLOON_TARGET_RATIO -
      this.activeBalloon.radiusY * 0.68 -
      upwardLift;
    const revealProgress = clamp(progress * 1.25, 0, 1);
    this.activeBalloon.x = this.width * this.activeSpawnXRatio;
    this.activeBalloon.y =
      panelTopStartY + (targetY - panelTopStartY) * revealProgress;
  }

  private chooseSpawnXRatio(): number {
    if (this.mode === 'lung-test') {
      return 0.5;
    }

    const candidates = RUSH_SPAWN_LANES.filter(
      (lane) => Math.abs(lane - this.activeSpawnXRatio) > 0.01,
    );
    return candidates[Math.floor(Math.random() * candidates.length)] ?? 0.5;
  }

  private finishLungTest(): void {
    if (this.finished) return;
    this.finished = true;
    const baseRadius = 22;
    const baseAverageRadius = this.getBaseAverageRadius(baseRadius);
    this.onFinish({
      mode: 'lung-test',
      durationMs: this.totalBlowingMs,
      averageWindStrength: calculateAverageWind(
        this.windIntegral,
        this.totalBlowingMs,
      ),
      peakWindStrength: this.peakWind,
      finalBalloonScale: calculateBalloonScore(
        this.averageRadius(this.activeBalloon),
        baseAverageRadius,
      ),
      balloon: structuredClone(this.activeBalloon),
    });
  }

  private finishRush(): void {
    if (this.finished) return;
    this.finished = true;
    this.onFinish({
      mode: 'balloon-rush',
      durationMs: BALLOON_RUSH_DURATION_MS,
      completedCount: this.completedBalloons.length,
      completionTimeMs: this.lastCompletionElapsedMs,
      totalBlowingMs: this.totalBlowingMs,
      balloons: structuredClone(this.completedBalloons),
    });
  }

  private publishHud(deltaMs: number, signal: DetectorFrame): void {
    this.hudAccumulatorMs += deltaMs;
    if (this.hudAccumulatorMs < 100) return;
    this.hudAccumulatorMs = 0;
    this.onHudChange({
      elapsedMs: this.elapsedMs,
      remainingMs:
        this.mode === 'balloon-rush'
          ? Math.max(0, BALLOON_RUSH_DURATION_MS - this.elapsedMs)
          : 0,
      completedCount: this.completedBalloons.length,
      windStrength: signal.windStrength,
      isWaitingForBreath:
        this.mode === 'lung-test' && !this.lungBreathStarted,
    });
  }

  private draw(timeMs: number, windStrength: number): void {
    const context = this.context;
    context.fillStyle = this.background ?? APP_THEME.paper;
    context.fillRect(0, 0, this.width, this.height);

    this.drawInteractiveBackground(timeMs);

    for (const balloon of this.completedBalloons) {
      const isRelieved = (balloon.variant.seed % 3) === 0;
      drawBalloon(
        context,
        balloon,
        timeMs,
        0.96,
        0,
        {
          growthProgress: 0,
          windStrength: 0,
          settlingProgress: isRelieved ? 1 : 0,
        },
        this.getCompletedImage(balloon.variant.assetId),
      );
    }

    if (!this.finished) {
      this.activeBalloon.rotation =
        Math.sin(timeMs * 0.003) * (0.025 + windStrength * 0.035);
      const baseRadius = 22;
      const baseAverageRadius = this.getBaseAverageRadius(baseRadius);
      const maximumLungRadius = this.getMaximumActiveRadius();
      const isLungTest = this.mode === 'lung-test';
      const growthProgress = isLungTest
        ? clamp(
            (this.averageRadius(this.activeBalloon) - baseAverageRadius) /
              Math.max(1, maximumLungRadius - baseAverageRadius),
            0,
            1,
          )
        : 0;
      const activeWind = isLungTest ? windStrength : 0;
      const targetRushAverageRadius = this.getBaseAverageRadius(RUSH_MAX_RADIUS);
      const rushProgress = !isLungTest
        ? clamp(
            (this.averageRadius(this.activeBalloon) - baseAverageRadius) /
              Math.max(1, targetRushAverageRadius - baseAverageRadius),
            0,
            1,
          )
        : 1;

      if (isLungTest || rushProgress > 0) {
        drawBalloon(
          context,
          this.activeBalloon,
          timeMs,
          1,
          activeWind,
          {
            growthProgress,
            windStrength: activeWind,
            settlingProgress: isLungTest
              ? clamp(this.lungSettlingMs / 700, 0, 1)
              : 0,
          },
          this.mode === 'balloon-rush'
            ? (getBalloonImage(this.activeBalloon.variant.assetId) ?? undefined)
            : undefined,
        );
      }
    }
  }

  private drawInteractiveBackground(timeMs: number): void {
    const context = this.context;

    context.save();

    // Colorful paper confetti floats gently across the whole background.
    // Each piece has its own height, phase, sway, and rotation.
    const confettiColors = [
      APP_THEME.coral,
      APP_THEME.butter,
      APP_THEME.sageDeep,
      APP_THEME.sky,
      APP_THEME.white,
    ] as const;
    for (let index = 0; index < 14; index += 1) {
      const cycle = 2600 + index * 150;
      const progress =
        ((timeMs * 0.024 + index * 230) % cycle) / cycle;
      const baseX = ((index * 83 + 24) % Math.max(90, this.width - 48)) + 24;
      const baseY = this.height * (0.08 + ((index * 0.271) % 0.84));
      const x =
        baseX +
        Math.sin(timeMs * 0.0015 + index * 2) * 16 +
        progress * 30;
      const y =
        baseY -
        progress * this.height * 0.16 +
        Math.sin(timeMs * 0.0012 + index * 1.4) * 18;
      const width = 5 + (index % 3) * 2;
      const height = 3 + (index % 2) * 2;

      context.save();
      context.translate(x, y);
      context.rotate(
        timeMs * 0.0018 * (index % 2 === 0 ? 1 : -1) +
          Math.sin(timeMs * 0.002 + index) * 0.45,
      );
      context.globalAlpha = 0.42;
      context.fillStyle = confettiColors[index % confettiColors.length]!;
      context.fillRect(-width / 2, -height / 2, width, height);
      context.globalAlpha = 0.3;
      context.strokeStyle = APP_THEME.white;
      context.lineWidth = 0.8;
      context.strokeRect(-width / 2, -height / 2, width, height);
      context.restore();
    }
    context.restore();
  }

  private getMaximumActiveRadius(): number {
    return this.mode === 'lung-test'
      ? Math.max(this.width, this.height) * 0.36
      : RUSH_MAX_RADIUS;
  }


  private averageRadius(balloon: BalloonBody): number {
    return (balloon.radiusX + balloon.radiusY) / 2;
  }

  private getBaseAverageRadius(baseRadius: number): number {
    const bodyAspect = this.activeBalloon.radiusY / this.activeBalloon.radiusX;
    return (baseRadius + baseRadius * bodyAspect) / 2;
  }

  private getPlayHeight(): number {
    return Math.max(220, this.height - this.playBottomInset);
  }

  private getCompletedImage(assetId: number): CanvasImageSource | undefined {
    const cached = this.completedImageCache.get(assetId);
    if (cached) return cached;
    const source = getBalloonImage(assetId);
    if (!source?.complete || source.naturalWidth === 0) return undefined;
    const asset = getBalloonAsset(assetId);
    const image = document.createElement('canvas');
    image.width = 256;
    image.height = Math.round((image.width * asset.height) / asset.width);
    const context = image.getContext('2d');
    if (!context) return undefined;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, image.width, image.height);
    this.completedImageCache.set(assetId, image);
    return image;
  }
}
