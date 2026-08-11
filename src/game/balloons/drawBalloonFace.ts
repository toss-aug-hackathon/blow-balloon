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
  const relief = smoothstep(0.12, 0.78, settlingProgress);

  return {
    eyeOpen: lerp(lerp(0.1, 0.17, surprise), 0.045, strain),
    mouthCurve: lerp(0.008 + delight * 0.06 - surprise * 0.035, -0.035, strain),
    mouthOpen: lerp(0.008 + surprise * 0.075, 0.012, strain) * (1 - relief),
    cheekPuff: delight * 0.035 + strain * 0.085,
    strain,
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
  const pose = getBalloonFacePose(motion.growthProgress, motion.settlingProgress);
  const blink = blinkOpenness(timeMs, seed);
  const eyeOpen = pose.eyeOpen * blink * (1 - pose.relief);
  const pupilShift = Math.sin(timeMs * 0.0008 + seed) * 0.014;
  const activeStrain = pose.strain * (1 - pose.relief);
  const mouthTremble =
    Math.sin(timeMs * 0.035 + seed) * activeStrain * motion.windStrength * 0.012;
  const cheekRadius =
    0.075 +
    pose.cheekPuff +
    Math.sin(timeMs * 0.012 + seed) * motion.windStrength * 0.012;

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

  if (pose.relief < 1) {
    for (const side of [-1, 1]) {
      const x = side * 0.2;
      context.save();
      context.globalAlpha = 1 - pose.relief;
      context.fillStyle = 'rgba(255,255,255,0.94)';
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
  context.beginPath();
  context.moveTo(-mouthWidth, mouthY);
  context.quadraticCurveTo(
    0,
    mouthY + lerp(pose.mouthCurve, 0.075, pose.relief),
    mouthWidth,
    mouthY,
  );
  context.stroke();
  if (pose.mouthOpen > 0.012) {
    context.beginPath();
    context.ellipse(0, mouthY + 0.018, mouthWidth * 0.52, pose.mouthOpen, 0, 0, Math.PI * 2);
    context.fill();
  }

  if (pose.strain > 0) {
    const sweatCycle = ((timeMs + seed) % 1500) / 1500;
    context.globalAlpha = pose.strain * (1 - pose.relief);
    context.fillStyle = 'rgba(255,255,255,0.9)';
    context.beginPath();
    context.moveTo(0.38, -0.3 + sweatCycle * 0.08);
    context.quadraticCurveTo(0.31, -0.18, 0.38, -0.14 + sweatCycle * 0.08);
    context.quadraticCurveTo(0.45, -0.18, 0.38, -0.3 + sweatCycle * 0.08);
    context.fill();
  }
  context.restore();
}
