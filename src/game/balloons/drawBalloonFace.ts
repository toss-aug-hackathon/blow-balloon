import { clamp, lerp } from '../../utils/math';

export type BalloonFaceMotion = {
  growthProgress: number;
  windStrength: number;
  settlingProgress: number;
};

export type BalloonFaceCharacter =
  | 0
  | 1
  | 2
  | 3
  | 4;

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
    smoothstep(0.4, 0.44, growth) * (1 - smoothstep(0.56, 0.6, growth));
  const delight =
    smoothstep(0.2, 0.24, growth) * (1 - smoothstep(0.36, 0.4, growth));
  const strain = smoothstep(0.6, 0.64, growth);
  const squeeze = smoothstep(0.8, 0.84, growth);
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

function getCharacterEffort(motion: BalloonFaceMotion): number {
  const growthEffort = smoothstep(0.5, 0.86, motion.growthProgress);
  return clamp(
    growthEffort * (0.72 + motion.windStrength * 0.28) *
      (1 - motion.settlingProgress),
    0,
    1,
  );
}

function drawCharacterStrain(
  context: CanvasRenderingContext2D,
  timeMs: number,
  seed: number,
  motion: BalloonFaceMotion,
  character: BalloonFaceCharacter,
): void {
  const effort = getCharacterEffort(motion);
  if (effort < 0.03) return;

  // The character itself owns its eyes and mouth. Do not draw a second face
  // here; this layer is intentionally limited to one small character cue.
  context.save();
  if (effort > 0.62) {
    const cycle = ((timeMs + seed * 13) % 1100) / 1100;
    const sweatX = character === 1 ? -0.4 : character === 2 ? 0.38 : character === 4 ? -0.38 : 0.4;
    const sweatScale = character === 3 ? 1.18 : character === 1 ? 0.86 : 1;
    context.globalAlpha = (effort - 0.62) * 1.9;
    context.translate(sweatX, -0.22 + cycle * 0.035);
    context.scale(sweatScale, sweatScale);
    context.fillStyle = '#2f9fbd';
    context.beginPath();
    context.moveTo(0, -0.09);
    context.bezierCurveTo(-0.06, -0.01, -0.055, 0.06, 0, 0.07);
    context.bezierCurveTo(0.055, 0.06, 0.06, -0.01, 0, -0.09);
    context.fill();
    context.fillStyle = 'rgba(236, 255, 255, 0.9)';
    context.globalAlpha *= 0.9;
    context.beginPath();
    context.ellipse(-0.018, -0.025, 0.012, 0.025, 0.35, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawClassicFace(
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
  context.globalAlpha = 0.24 + pose.cheekPuff * 2.2;
  context.fillStyle = '#ff5d67';
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
      const eyeY = 0.015;
      context.save();
      context.globalAlpha = normalAlpha;
      const openHeight = Math.max(0.008, eyeOpen * 1.12);
      context.fillStyle = 'rgba(255,252,248,0.96)';
      context.strokeStyle = '#4a1d30';
      context.lineWidth = 0.025;
      context.beginPath();
      context.ellipse(x, eyeY, 0.125, openHeight, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      const iris = context.createRadialGradient(
        x + pupilShift - 0.018,
        eyeY - 0.05,
        0.008,
        x + pupilShift,
        eyeY + 0.015,
        0.07,
      );
      iris.addColorStop(0, '#8f2948');
      iris.addColorStop(0.5, '#5a1732');
      iris.addColorStop(1, '#2f1022');
      context.fillStyle = iris;
      context.beginPath();
      context.ellipse(
        x + pupilShift,
        eyeY + 0.015,
        0.066,
        Math.max(0.006, openHeight * 0.76),
        0,
        0,
        Math.PI * 2,
      );
      context.fill();

      if (openHeight > 0.055) {
        context.fillStyle = 'rgba(255,255,255,0.94)';
        context.beginPath();
        context.ellipse(
          x + pupilShift - 0.026,
          eyeY - 0.05,
          0.018,
          0.026,
          -0.35,
          0,
          Math.PI * 2,
        );
        context.fill();
        context.globalAlpha = normalAlpha * 0.72;
        context.beginPath();
        context.arc(x + pupilShift + 0.025, eyeY + 0.055, 0.009, 0, Math.PI * 2);
        context.fill();
      }
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
    context.moveTo(x - side * 0.07, -0.22 + browTension);
    context.quadraticCurveTo(
      x,
      -0.265 - pose.relief * 0.025,
      x + side * 0.07,
      -0.22 - browTension,
    );
    context.stroke();
  }

  const mouthWidth = 0.105 + pose.strain * 0.07 + pose.relief * 0.08;
  const mouthY = 0.24 + mouthTremble;
  if (normalAlpha > 0) {
    context.save();
    context.globalAlpha = normalAlpha;
    if (pose.mouthOpen > 0.012) {
      context.fillStyle = '#681a32';
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
  drawCharacterStrain(context, timeMs, seed, motion, 0);
  context.restore();
}

function drawSleepyFace(
  context: CanvasRenderingContext2D,
  timeMs: number,
  seed: number,
  motion: BalloonFaceMotion,
): void {
  const pose = getBalloonFacePose(motion.growthProgress, motion.settlingProgress);
  const blink = blinkOpenness(timeMs, seed);
  const effort = getCharacterEffort(motion);
  const eyeLift = 0.02 + pose.strain * 0.02 + effort * 0.05;

  context.save();
  context.strokeStyle = '#4a1d30';
  context.fillStyle = '#4a1d30';
  context.lineCap = 'round';
  context.lineWidth = 0.055;
  for (const side of [-1, 1]) {
    const x = side * 0.2;
    context.globalAlpha = 0.95;
    context.beginPath();
    context.moveTo(x - side * 0.1, 0.02 - eyeLift * blink);
    context.quadraticCurveTo(x, -0.08 - eyeLift * blink, x + side * 0.1, 0.02 - eyeLift * blink);
    context.stroke();
  }
  context.globalAlpha = 0.8;
  context.beginPath();
  context.arc(0, 0.23, 0.07 + pose.mouthOpen * 0.7 + effort * 0.035, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 0.3 + pose.cheekPuff * 2;
  context.fillStyle = '#ff7280';
  context.beginPath();
  context.arc(-0.31, 0.18, 0.09, 0, Math.PI * 2);
  context.arc(0.31, 0.18, 0.09, 0, Math.PI * 2);
  context.fill();
  context.restore();
  drawCharacterStrain(context, timeMs, seed, motion, 1);
}

function drawWinkFace(
  context: CanvasRenderingContext2D,
  timeMs: number,
  seed: number,
  motion: BalloonFaceMotion,
): void {
  const pose = getBalloonFacePose(motion.growthProgress, motion.settlingProgress);
  const blink = blinkOpenness(timeMs, seed);
  const effort = getCharacterEffort(motion);
  const winkTremble = Math.sin(timeMs * 0.032 + seed) * effort * 0.018;

  context.save();
  context.strokeStyle = '#432036';
  context.fillStyle = '#432036';
  context.lineCap = 'round';
  context.lineWidth = 0.045;
  context.beginPath();
  context.ellipse(-0.2, 0.01, 0.09, 0.13 * blink, 0, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.moveTo(0.1, 0.02 + winkTremble);
  context.quadraticCurveTo(0.2, -0.08 - effort * 0.035, 0.3, 0.02 - winkTremble);
  context.stroke();
  context.lineWidth = 0.035;
  context.beginPath();
  context.moveTo(-0.16, 0.24);
  context.quadraticCurveTo(0, 0.3 + pose.strain * 0.08, 0.16, 0.24);
  context.stroke();
  context.globalAlpha = 0.45;
  context.fillStyle = '#ff6472';
  context.beginPath();
  context.arc(-0.32, 0.2, 0.08, 0, Math.PI * 2);
  context.arc(0.32, 0.2, 0.08, 0, Math.PI * 2);
  context.fill();
  context.restore();
  drawCharacterStrain(context, timeMs, seed, motion, 2);
}

function drawStarryFace(
  context: CanvasRenderingContext2D,
  timeMs: number,
  seed: number,
  motion: BalloonFaceMotion,
): void {
  const blink = blinkOpenness(timeMs, seed);
  const effort = getCharacterEffort(motion);
  const twinkle =
    (0.8 + Math.sin(timeMs * 0.006 + seed) * 0.2) * (1 - effort * 0.82);
  const starPulse = 1 + Math.sin(timeMs * 0.009 + seed) * 0.08 * (1 - effort);

  context.save();
  context.fillStyle = '#482039';
  context.strokeStyle = '#482039';
  context.lineWidth = 0.03;
  for (const side of [-1, 1]) {
    const x = side * 0.2;
    context.globalAlpha = 0.95;
    context.beginPath();
    context.arc(x, 0.02, 0.105 * blink, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fffaf6';
    context.globalAlpha = twinkle;
    context.beginPath();
    context.arc(x - 0.03, -0.025, 0.028 * starPulse, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#482039';
  }
  context.globalAlpha = 0.9;
  context.beginPath();
  context.arc(0, 0.25, 0.07, 0, Math.PI * 2);
  context.fill();
  context.restore();
  drawCharacterStrain(context, timeMs, seed, motion, 3);
}

function drawFlusteredFace(
  context: CanvasRenderingContext2D,
  timeMs: number,
  seed: number,
  motion: BalloonFaceMotion,
): void {
  const blink = blinkOpenness(timeMs, seed);
  const effort = getCharacterEffort(motion);
  const gasp = 0.035 + effort * 0.045;

  context.save();
  context.strokeStyle = '#432036';
  context.fillStyle = '#432036';
  context.lineCap = 'round';
  context.lineWidth = 0.045;
  context.beginPath();
  context.ellipse(-0.2, 0.02, 0.075, 0.12 * blink, 0, 0, Math.PI * 2);
  context.ellipse(0.2, 0.02, 0.075, 0.12 * blink, 0, 0, Math.PI * 2);
  context.fill();

  // A small startled mouth replaces the tongue character.
  context.fillStyle = '#5b1732';
  context.beginPath();
  context.ellipse(0, 0.26, 0.065 + effort * 0.02, gasp, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#ff6978';
  context.globalAlpha = 0.5 + effort * 0.3;
  context.beginPath();
  context.arc(-0.31, 0.2, 0.085 + effort * 0.025, 0, Math.PI * 2);
  context.arc(0.31, 0.2, 0.085 + effort * 0.025, 0, Math.PI * 2);
  context.fill();
  context.restore();
  drawCharacterStrain(context, timeMs, seed, motion, 4);
}

export function drawBalloonFace(
  context: CanvasRenderingContext2D,
  timeMs: number,
  seed: number,
  faceId: number,
  motion: BalloonFaceMotion,
): void {
  switch ((faceId % 5 + 5) % 5 as BalloonFaceCharacter) {
    case 1:
      drawSleepyFace(context, timeMs, seed, motion);
      return;
    case 2:
      drawWinkFace(context, timeMs, seed, motion);
      return;
    case 3:
      drawStarryFace(context, timeMs, seed, motion);
      return;
    case 4:
      drawFlusteredFace(context, timeMs, seed, motion);
      return;
    default:
      drawClassicFace(context, timeMs, seed, motion);
  }
}
