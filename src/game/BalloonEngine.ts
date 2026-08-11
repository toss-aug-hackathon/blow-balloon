import type { DetectorFrame } from '../audio/blowDetector';
import { clamp } from '../utils/math';
import {
  createBalloonBody,
  createRandomVariant,
} from './balloons/createBalloon';
import { getBalloonAsset, getBalloonImage } from './balloons/balloonAssets';
import { drawBalloon } from './balloons/drawBalloon';
import { APP_THEME } from '../styles/theme';
import { updateHeliumPhysics } from './physics/physics';
import {
  BALLOON_RUSH_DURATION_MS,
  LUNG_MAX_GROWTH_DURATION_MS,
  calculateAverageWind,
  calculateBalloonScore,
  hasLungBreathEnded,
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
  context: CanvasRenderingContext2D;
  onHudChange: (hud: GameHudState) => void;
  onFinish: (result: GameResult) => void;
};

const ACTIVE_BALLOON_BOTTOM_RATIO = 0.88;
const LUNG_ACTIVE_BALLOON_START_Y_RATIO = 0.68;
const LUNG_ACTIVE_BALLOON_CENTER_Y_RATIO = 0.5;
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
  private windIntegral = 0;
  private peakWind = 0;
  private lungBreathStarted = false;
  private lungGapMs = 0;
  private lungSettlingMs = 0;
  private finished = false;
  private paused = false;
  private hudAccumulatorMs = 0;
  private background: CanvasGradient | null = null;
  private readonly completedImageCache = new Map<number, HTMLCanvasElement>();
  private activeSpawnXRatio = 0.5;
  private hasChosenInitialSpawn = false;

  constructor(options: BalloonEngineOptions) {
    this.mode = options.mode;
    this.context = options.context;
    this.onHudChange = options.onHudChange;
    this.onFinish = options.onFinish;
    this.activeBalloon = createBalloonBody(createRandomVariant(), 0, 0);
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

    if (signal.state === 'blowing') {
      this.lungBreathStarted = true;
      this.lungGapMs = 0;
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
        (1.05 + signal.windStrength * 0.35) *
        deltaSeconds;
      this.growActiveBalloon(growth);
    } else if (this.lungBreathStarted) {
      this.lungGapMs += deltaMs;
      if (hasLungBreathEnded(this.lungGapMs)) this.lungSettlingMs = 1;
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
      const growth = 37 * (0.72 + signal.windStrength * 0.28) * deltaSeconds;
      this.growActiveBalloon(growth);
      if (isBalloonComplete(this.averageRadius(this.activeBalloon))) {
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
    this.activeBalloon.vy = -42 - Math.random() * 20;
    this.activeBalloon.angularVelocity = (Math.random() - 0.5) * 0.2;
    this.completedBalloons.push(this.activeBalloon);
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
    const maximumRadius = this.getMaximumActiveRadius();
    const progress = clamp(
      (this.averageRadius(this.activeBalloon) - baseRadius) /
        Math.max(1, maximumRadius - baseRadius),
      0,
      1,
    );
    if (this.mode === 'lung-test') {
      // Start in the lower third, then move the balloon's center to the
      // screen center while it grows quickly and dramatically.
      const centerMoveProgress = clamp(progress * 1.8, 0, 1);
      this.activeBalloon.x = this.width * 0.5;
      this.activeBalloon.y =
        this.height *
        (LUNG_ACTIVE_BALLOON_START_Y_RATIO -
          (LUNG_ACTIVE_BALLOON_START_Y_RATIO -
            LUNG_ACTIVE_BALLOON_CENTER_Y_RATIO) *
            centerMoveProgress);
      return;
    }

    const upwardLift = this.height * 0.13 * progress;
    this.activeBalloon.x = this.width * this.activeSpawnXRatio;
    this.activeBalloon.y =
      this.height * ACTIVE_BALLOON_BOTTOM_RATIO -
      this.activeBalloon.radiusY * 0.68 -
      upwardLift;
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
        baseRadius,
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
      drawBalloon(
        context,
        balloon,
        timeMs,
        0.96,
        0,
        undefined,
        this.getCompletedImage(balloon.variant.assetId),
      );
    }

    if (!this.finished) {
      this.drawWindFlow(timeMs, windStrength);
      this.activeBalloon.rotation =
        Math.sin(timeMs * 0.003) * (0.025 + windStrength * 0.035);
      const baseRadius = 22;
      const maximumLungRadius = this.getMaximumActiveRadius();
      drawBalloon(
        context,
        this.activeBalloon,
        timeMs,
        1,
        windStrength,
        this.mode === 'lung-test'
          ? {
              growthProgress: clamp(
                (this.averageRadius(this.activeBalloon) - baseRadius) /
                  Math.max(1, maximumLungRadius - baseRadius),
                0,
                1,
              ),
              windStrength,
              settlingProgress: clamp(this.lungSettlingMs / 700, 0, 1),
            }
          : undefined,
        this.mode === 'balloon-rush'
          ? (getBalloonImage(this.activeBalloon.variant.assetId) ?? undefined)
          : undefined,
      );
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

  private drawWindFlow(timeMs: number, windStrength: number): void {
    if (windStrength < 0.035) return;

    const context = this.context;
    const strength = clamp(windStrength, 0, 1);
    const originY = this.height * 0.99;
    const targetY = this.activeBalloon.y + this.activeBalloon.radiusY * 0.72;
    const distance = Math.max(100, originY - targetY);
    const flowSpeed = timeMs * (0.0009 + strength * 0.0014);
    const ribbonGradient = context.createLinearGradient(
      0,
      originY,
      0,
      targetY,
    );
    ribbonGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    ribbonGradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.08)');
    ribbonGradient.addColorStop(0.82, 'rgba(255, 255, 255, 0.28)');
    ribbonGradient.addColorStop(1, 'rgba(255, 225, 211, 0.48)');

    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = ribbonGradient;

    for (let index = 0; index < 3; index += 1) {
      const offset = (index - 1) * (18 + strength * 5);
      const phase = flowSpeed + index * 1.9;
      const sway = Math.sin(phase) * (13 + strength * 10);
      const startX = this.activeBalloon.x + offset + sway;
      const endX = this.activeBalloon.x + offset * 0.42;
      const controlOneX = startX - sway * 0.8;
      const controlTwoX = endX + Math.sin(phase + 1.2) * 22;
      const startY = originY + index * 12;
      const endPointY = targetY + index * 4;

      context.globalAlpha = 0.62 - index * 0.09;
      context.lineWidth = 4 + strength * 5 - index * 0.65;
      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(
        controlOneX,
        startY - distance * 0.28,
        controlTwoX,
        startY - distance * 0.72,
        endX,
        endPointY,
      );
      context.stroke();

      context.globalAlpha = 0.18 + strength * 0.12;
      context.lineWidth = 1.2;
      context.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      context.beginPath();
      context.moveTo(startX, startY - 2);
      context.bezierCurveTo(
        controlOneX + 3,
        startY - distance * 0.28,
        controlTwoX - 3,
        startY - distance * 0.72,
        endX,
        endPointY,
      );
      context.stroke();
      context.strokeStyle = ribbonGradient;
    }

    // Small bubbles drift along the upper part of the breeze as it reaches
    // the balloon, making the air feel soft instead of like rigid lines.
    context.fillStyle = 'rgba(255, 255, 255, 0.52)';
    for (let index = 0; index < 4; index += 1) {
      const progress = (flowSpeed * 0.8 + index * 0.23) % 1;
      const x =
        this.activeBalloon.x +
        Math.sin(timeMs * 0.002 + index * 2.4) * (12 + strength * 12);
      const y = targetY + distance * (0.12 + progress * 0.42);
      const radius = 1.8 + ((index + 1) % 2) * 1.1;
      context.globalAlpha = (1 - progress) * (0.22 + strength * 0.28);
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  private getMaximumActiveRadius(): number {
    return this.mode === 'lung-test'
      ? Math.max(this.width, this.height) * 0.36
      : 62;
  }


  private averageRadius(balloon: BalloonBody): number {
    return (balloon.radiusX + balloon.radiusY) / 2;
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
