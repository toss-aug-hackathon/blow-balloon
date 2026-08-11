import type { DetectorFrame } from '../audio/blowDetector';
import { clamp } from '../utils/math';
import {
  createBalloonBody,
  createRandomVariant,
} from './balloons/createBalloon';
import { drawBalloon } from './balloons/drawBalloon';
import { APP_THEME } from '../styles/theme';
import { updateHeliumPhysics } from './physics/physics';
import {
  BALLOON_RUSH_DURATION_MS,
  calculateAverageWind,
  calculateBalloonScore,
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
  private lungSettlingMs = 0;
  private finished = false;
  private paused = false;
  private hudAccumulatorMs = 0;

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
    if (!this.lungBreathStarted && this.completedBalloons.length === 0) {
      this.positionActiveBalloon();
    } else {
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

    if (signal.isBlowing) {
      this.lungBreathStarted = true;
      this.elapsedMs += deltaMs;
      this.totalBlowingMs += deltaMs;
      this.windIntegral += signal.windStrength * deltaMs;
      this.peakWind = Math.max(this.peakWind, signal.windStrength);
      const growth = 19 * (0.75 + signal.windStrength * 0.25) * deltaSeconds;
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
    const maximumRadius =
      this.mode === 'lung-test'
        ? Math.min(this.width, this.height) * 0.48
        : 62;
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
    this.positionActiveBalloon();
  }

  private positionActiveBalloon(): void {
    this.activeBalloon.x = this.width * 0.5;
    this.activeBalloon.y = this.height * (this.mode === 'lung-test' ? 0.5 : 0.58);
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
    context.clearRect(0, 0, this.width, this.height);
    const background = context.createLinearGradient(0, 0, 0, this.height);
    background.addColorStop(0, APP_THEME.paper);
    background.addColorStop(0.52, APP_THEME.paper);
    background.addColorStop(1, APP_THEME.paperDeep);
    context.fillStyle = background;
    context.fillRect(0, 0, this.width, this.height);

    context.fillStyle = 'rgba(255,255,255,0.58)';
    for (let index = 0; index < 5; index += 1) {
      const x =
        ((index * 103 + timeMs * (0.004 + index * 0.0008)) %
          (this.width + 80)) -
        40;
      const y = 90 + ((index * 137) % Math.max(100, this.height - 180));
      context.beginPath();
      context.arc(x, y, 3 + (index % 3), 0, Math.PI * 2);
      context.fill();
    }

    [...this.completedBalloons]
      .sort((first, second) => first.depth - second.depth)
      .forEach((balloon) => drawBalloon(context, balloon, timeMs, 0.96));

    if (!this.finished) {
      this.activeBalloon.rotation =
        Math.sin(timeMs * 0.003) * (0.025 + windStrength * 0.035);
      const baseRadius = 22;
      const maximumLungRadius = Math.min(this.width, this.height) * 0.48;
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
      );
    }
  }


  private averageRadius(balloon: BalloonBody): number {
    return (balloon.radiusX + balloon.radiusY) / 2;
  }
}
