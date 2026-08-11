import { clamp, lerp } from '../../utils/math';

export type BalloonFaceMotion = {
  growthProgress: number;
  windStrength: number;
  settlingProgress: number;
};

export type BalloonFacePose = {
  eyeOpen: number;
  mouthCurve: number;
  mouthOpen: number;
  cheekPuff: number;
  strain: number;
  squeeze: number;
  relief: number;
};

function smoothstep(from: number, to: number, value: number): number {
  const progress = clamp((value - from) / (to - from), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

export function getBalloonFacePose(
  growthProgress: number,
  settlingProgress: number,
): BalloonFacePose {
  const growth = clamp(growthProgress, 0, 1);
  const surprise =
    smoothstep(0.18, 0.4, growth) * (1 - smoothstep(0.5, 0.7, growth));
  const delight =
    smoothstep(0.04, 0.22, growth) * (1 - smoothstep(0.3, 0.5, growth));
  const strain = smoothstep(0.52, 0.94, growth);
  const squeeze = smoothstep(0.78, 0.94, growth);
  const relief = smoothstep(0.12, 0.78, settlingProgress);

  return {
    eyeOpen: lerp(lerp(0.1, 0.17, surprise), 0.045, strain),
    mouthCurve: lerp(0.008 + delight * 0.06 - surprise * 0.035, -0.035, strain),
    mouthOpen: lerp(0.008 + surprise * 0.075, 0.012, strain) * (1 - relief),
    cheekPuff: delight * 0.035 + strain * 0.085,
    strain,
    squeeze,
    relief,
  };
}

function blinkOpenness(timeMs: number, seed: number): number {
  const duration = 2800 + (seed % 1700);
  const position = (timeMs + seed * 17) % duration;
  if (position >= 180) return 1;
  return position < 90 ? 1 - position / 90 : (position - 90) / 90;
}

export function drawBalloonFace(
  context: CanvasRenderingContext2D,
  timeMs: number,
  seed: number,
  motion: BalloonFaceMotion,
): void {
  const pose = getBalloonFacePose(
    motion.growthProgress,
    motion.settlingProgress,
  );
  const blink = blinkOpenness(timeMs, seed);
  const normalAlpha = clamp(1 - pose.squeeze - pose.relief, 0, 1);
  const squeezeAlpha = pose.squeeze * (1 - pose.relief);
  const eyeOpen = pose.eyeOpen * blink;
  const pupilShift = Math.sin(timeMs * 0.0008 + seed) * 0.014;
  const cheekPulse =
    Math.sin(timeMs * 0.012 + seed) * motion.windStrength * 0.012;
  const cheekRadius = 0.075 + pose.cheekPuff + cheekPulse;
  const activeStrain = pose.strain * (1 - pose.relief);
  const mouthTremble =
    Math.sin(timeMs * 0.035 + seed) *
    activeStrain *
    motion.windStrength *
    0.012;

  context.save();
  context.globalAlpha = 0.2 + pose.cheekPuff * 2.5;
  context.fillStyle = '#ff4968';
  context.beginPath();
  context.arc(-0.3, 0.2, cheekRadius, 0, Math.PI * 2);
  context.arc(0.3, 0.2, cheekRadius, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.globalAlpha = 1;
  context.strokeStyle = '#3f2433';
  context.fillStyle = '#3f2433';
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = 0.05;

  if (normalAlpha > 0) {
    for (const side of [-1, 1]) {
      const x = side * 0.2;
      context.save();
      context.globalAlpha = normalAlpha;
      context.fillStyle = 'rgba(255,255,255,0.9)';
      context.beginPath();
      context.ellipse(x, -0.02, 0.105, Math.max(0.008, eyeOpen), 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#3f2433';
      context.beginPath();
      context.ellipse(
        x + pupilShift,
        -0.01,
        0.045,
        Math.max(0.006, eyeOpen * 0.62),
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.restore();
    }
  }

  if (squeezeAlpha > 0) {
    context.save();
    context.globalAlpha = squeezeAlpha;
    for (const side of [-1, 1]) {
      const x = side * 0.2;
      context.beginPath();
      context.moveTo(x + side * 0.075, -0.1);
      context.lineTo(x - side * 0.04, -0.01);
      context.lineTo(x + side * 0.075, 0.08);
      context.stroke();
    }
    context.restore();
  }

  if (pose.relief > 0) {
    context.save();
    context.globalAlpha = pose.relief;
    for (const side of [-1, 1]) {
      const x = side * 0.2;
      context.beginPath();
      context.moveTo(x - 0.075, -0.01);
      context.quadraticCurveTo(x, 0.055, x + 0.075, -0.01);
      context.stroke();
    }
    context.restore();
  }

  const browTension = activeStrain * 0.08 + motion.windStrength * 0.02;
  for (const side of [-1, 1]) {
    const x = side * 0.2;
    context.beginPath();
    context.moveTo(x - side * 0.07, -0.2 + browTension);
    context.quadraticCurveTo(
      x,
      -0.24 - pose.relief * 0.025,
      x + side * 0.07,
      -0.2 - browTension,
    );
    context.stroke();
  }

  const mouthWidth = 0.1 + pose.strain * 0.07 + pose.relief * 0.08;
  const mouthY = 0.24 + mouthTremble;
  if (normalAlpha > 0) {
    context.save();
    context.globalAlpha = normalAlpha;
    if (pose.mouthOpen > 0.012) {
      context.beginPath();
      context.ellipse(
        0,
        mouthY + 0.018,
        mouthWidth * 0.52,
        pose.mouthOpen,
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
    } else {
      context.beginPath();
      context.moveTo(-mouthWidth, mouthY);
      context.quadraticCurveTo(0, mouthY + pose.mouthCurve, mouthWidth, mouthY);
      context.stroke();
    }
    context.restore();
  }

  if (squeezeAlpha > 0) {
    context.save();
    context.globalAlpha = squeezeAlpha;
    context.beginPath();
    context.moveTo(-0.12, mouthY);
    context.quadraticCurveTo(-0.06, mouthY - 0.055, 0, mouthY);
    context.quadraticCurveTo(0.06, mouthY + 0.055, 0.12, mouthY);
    context.stroke();
    context.restore();
  }

  if (pose.relief > 0) {
    context.save();
    context.globalAlpha = pose.relief;
    context.beginPath();
    context.moveTo(-mouthWidth, mouthY);
    context.quadraticCurveTo(0, mouthY + 0.075, mouthWidth, mouthY);
    context.stroke();
    context.restore();
  }

  if (pose.strain > 0) {
    const sweatCycle = ((timeMs + seed) % 1500) / 1500;
    context.save();
    context.globalAlpha = pose.strain * (1 - pose.squeeze) * (1 - pose.relief);
    context.translate(0.39, -0.26 + sweatCycle * 0.06);
    context.rotate(0.18);
    context.fillStyle = '#70d7ff';
    context.beginPath();
    context.moveTo(0, -0.11);
    context.bezierCurveTo(-0.075, -0.015, -0.065, 0.07, 0, 0.085);
    context.bezierCurveTo(0.065, 0.07, 0.075, -0.015, 0, -0.11);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.78)';
    context.beginPath();
    context.ellipse(-0.02, -0.025, 0.012, 0.026, 0.35, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();
}
