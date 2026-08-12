import { clamp, lerp } from '../../utils/math';

export type BalloonFaceMotion = {
  growthProgress: number;
  windStrength: number;
  settlingProgress: number;
};

export type BalloonFaceCharacter = 0 | 1 | 2 | 3 | 4;

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
  const growthEffort = smoothstep(0.15, 0.88, motion.growthProgress);
  return clamp(
    growthEffort * (0.65 + motion.windStrength * 0.35) *
      (1 - motion.settlingProgress),
    0,
    1,
  );
}

// Draw cute 2.5D sweat droplet on temple/head
function drawSweatDrop(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  alpha: number,
  timeMs: number,
): void {
  if (alpha <= 0.01) return;
  const cycle = ((timeMs * 0.0018) % 1.2) / 1.2;
  const dropY = y + cycle * 0.035;

  context.save();
  context.globalAlpha = alpha;
  context.translate(x, dropY);
  context.scale(scale, scale);

  // Drop body
  context.fillStyle = '#38bdf8';
  context.beginPath();
  context.moveTo(0, -0.08);
  context.bezierCurveTo(-0.05, -0.01, -0.045, 0.055, 0, 0.065);
  context.bezierCurveTo(0.045, 0.055, 0.05, -0.01, 0, -0.08);
  context.fill();

  // Highlight
  context.fillStyle = 'rgba(240, 253, 255, 0.9)';
  context.beginPath();
  context.ellipse(-0.015, -0.02, 0.01, 0.022, 0.3, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

// Draw pop-art stress hash mark 💢
function drawStressMark(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  alpha: number,
): void {
  if (alpha <= 0.01) return;
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  context.scale(scale, scale);
  context.strokeStyle = '#ef4444';
  context.lineWidth = 0.035;
  context.lineCap = 'round';

  const r = 0.06;
  context.beginPath();
  // Curved cross lines
  context.moveTo(-r, -r * 0.4);
  context.quadraticCurveTo(0, -r * 0.8, r, -r * 0.4);
  context.moveTo(-r, r * 0.4);
  context.quadraticCurveTo(0, r * 0.8, r, r * 0.4);
  context.moveTo(-r * 0.4, -r);
  context.quadraticCurveTo(-r * 0.8, 0, -r * 0.4, r);
  context.moveTo(r * 0.4, -r);
  context.quadraticCurveTo(r * 0.8, 0, r * 0.4, r);
  context.stroke();
  context.restore();
}

// ----------------------------------------------------------------------
// CHARACTER 0: Classic / Bubbly (기본/클래식 - 버블이)
// Bright round glossy eyes morphing into cute puffed-cheek strain
// ----------------------------------------------------------------------
function drawClassicFace(
  context: CanvasRenderingContext2D,
  timeMs: number,
  seed: number,
  motion: BalloonFaceMotion,
): void {
  const effort = getCharacterEffort(motion);
  const relief = motion.settlingProgress;
  const blink = blinkOpenness(timeMs, seed);
  const tremble = Math.sin(timeMs * 0.035 + seed) * effort * motion.windStrength * 0.012;

  // Cheeks
  const cheekRadius = lerp(0.075, 0.135, effort);
  const cheekAlpha = lerp(0.35, 0.8, effort);
  context.save();
  context.fillStyle = '#ff5d67';
  context.globalAlpha = cheekAlpha;
  context.beginPath();
  context.arc(-0.3 - effort * 0.04, 0.18, cheekRadius, 0, Math.PI * 2);
  context.arc(0.3 + effort * 0.04, 0.18, cheekRadius, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // Eyebrows
  context.save();
  context.strokeStyle = '#3f2433';
  context.lineWidth = 0.04;
  context.lineCap = 'round';
  const browTilt = lerp(0, 0.06, effort);
  for (const side of [-1, 1]) {
    const bx = side * 0.2;
    const by = -0.18 + browTilt * (side === -1 ? 1 : -1) * side;
    context.beginPath();
    context.moveTo(bx - side * 0.07, by + browTilt);
    context.quadraticCurveTo(bx, by - 0.04 - browTilt * 0.5, bx + side * 0.07, by - browTilt);
    context.stroke();
  }
  context.restore();

  // Eyes (Single pass - no overlapping!)
  context.save();
  context.strokeStyle = '#3f2433';
  context.fillStyle = '#3f2433';
  context.lineWidth = 0.045;
  context.lineCap = 'round';

  for (const side of [-1, 1]) {
    const ex = side * 0.2;
    const ey = 0.0 + tremble;

    if (relief > 0.4) {
      // Happy relieved arc ^
      context.beginPath();
      context.moveTo(ex - 0.08, ey + 0.03);
      context.quadraticCurveTo(ex, ey - 0.07, ex + 0.08, ey + 0.03);
      context.stroke();
    } else if (effort > 0.72) {
      // Cute squeezed > < eyes
      const squish = (effort - 0.72) / 0.28;
      context.beginPath();
      context.moveTo(ex - side * 0.07, ey - 0.06);
      context.lineTo(ex + side * (0.02 - squish * 0.04), ey);
      context.lineTo(ex - side * 0.07, ey + 0.06);
      context.stroke();
    } else {
      // Glossy round eyes flattening smoothly with effort
      const eyeH = lerp(0.11, 0.05, effort / 0.72) * blink;
      const eyeW = lerp(0.09, 0.10, effort / 0.72);
      if (eyeH > 0.01) {
        // Eye base
        context.fillStyle = '#3f2433';
        context.beginPath();
        context.ellipse(ex, ey, eyeW, eyeH, 0, 0, Math.PI * 2);
        context.fill();

        // Dual specular highlights
        if (eyeH > 0.03) {
          context.fillStyle = '#ffffff';
          context.beginPath();
          context.arc(ex - 0.03, ey - eyeH * 0.35, 0.026, 0, Math.PI * 2);
          context.arc(ex + 0.025, ey + eyeH * 0.25, 0.014, 0, Math.PI * 2);
          context.fill();
        }
      } else {
        // Blink line
        context.beginPath();
        context.moveTo(ex - 0.07, ey);
        context.lineTo(ex + 0.07, ey);
        context.stroke();
      }
    }
  }
  context.restore();

  // Mouth (Single pass)
  context.save();
  context.strokeStyle = '#3f2433';
  context.fillStyle = '#5c1832';
  context.lineWidth = 0.045;
  context.lineCap = 'round';

  const mouthY = 0.22 + tremble;
  if (relief > 0.4) {
    // Relieved smile
    context.beginPath();
    context.moveTo(-0.11, mouthY);
    context.quadraticCurveTo(0, mouthY + 0.08, 0.11, mouthY);
    context.stroke();
  } else if (effort > 0.35) {
    // Air puffing blow hole 'o' with dark interior and tongue
    const openW = lerp(0.04, 0.08, (effort - 0.35) / 0.65);
    const openH = lerp(0.04, 0.10, (effort - 0.35) / 0.65);
    context.beginPath();
    context.ellipse(0, mouthY, openW, openH, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    // Small tongue inside
    context.fillStyle = '#ff758c';
    context.beginPath();
    context.ellipse(0, mouthY + openH * 0.4, openW * 0.6, openH * 0.45, 0, 0, Math.PI);
    context.fill();
  } else {
    // Happy curved smile
    const curve = lerp(0.06, 0.01, effort / 0.35);
    context.beginPath();
    context.moveTo(-0.1, mouthY);
    context.quadraticCurveTo(0, mouthY + curve, 0.1, mouthY);
    context.stroke();
  }
  context.restore();

  // Strain Cues
  drawSweatDrop(context, 0.38, -0.22, 1.0, effort * (1 - relief), timeMs);
}

// ----------------------------------------------------------------------
// CHARACTER 1: Sleepy / Chill (졸린/느긋 - 졸리)
// Droopy eyelids morphing into shocked wide-eyed panicked inflation!
// ----------------------------------------------------------------------
function drawSleepyFace(
  context: CanvasRenderingContext2D,
  timeMs: number,
  seed: number,
  motion: BalloonFaceMotion,
): void {
  const effort = getCharacterEffort(motion);
  const relief = motion.settlingProgress;
  const blink = blinkOpenness(timeMs, seed);
  const tremble = Math.sin(timeMs * 0.04 + seed) * effort * motion.windStrength * 0.015;

  // Cheeks (Puffed wide horizontally)
  const cheekW = lerp(0.09, 0.16, effort);
  const cheekH = lerp(0.06, 0.11, effort);
  context.save();
  context.fillStyle = '#ff7a6b';
  context.globalAlpha = lerp(0.4, 0.85, effort);
  context.beginPath();
  context.ellipse(-0.31 - effort * 0.05, 0.18, cheekW, cheekH, 0, 0, Math.PI * 2);
  context.ellipse(0.31 + effort * 0.05, 0.18, cheekW, cheekH, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // Eyebrows
  context.save();
  context.strokeStyle = '#4a1d30';
  context.lineWidth = 0.045;
  context.lineCap = 'round';
  for (const side of [-1, 1]) {
    const bx = side * 0.2;
    // Droopy brows turn into raised shocked brows
    const browY = lerp(-0.16, -0.24, effort);
    const browCurve = lerp(-0.02, 0.04, effort);
    context.beginPath();
    context.moveTo(bx - side * 0.08, browY);
    context.quadraticCurveTo(bx, browY - browCurve, bx + side * 0.08, browY + browCurve * 0.5);
    context.stroke();
  }
  context.restore();

  // Eyes
  context.save();
  context.strokeStyle = '#4a1d30';
  context.fillStyle = '#4a1d30';
  context.lineWidth = 0.05;
  context.lineCap = 'round';

  for (const side of [-1, 1]) {
    const ex = side * 0.2;
    const ey = 0.01 + tremble;

    if (relief > 0.4) {
      // Peaceful closed sleepy eyes (- -)
      context.beginPath();
      context.moveTo(ex - 0.08, ey);
      context.quadraticCurveTo(ex, ey - 0.04, ex + 0.08, ey);
      context.stroke();
    } else if (effort > 0.7) {
      // Panicked wide popping eyes with tiny shivering pupils!
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(ex, ey, 0.11, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      // Tiny shivering pupil
      context.fillStyle = '#4a1d30';
      context.beginPath();
      context.arc(ex + tremble * 2, ey + tremble * 2, 0.035, 0, Math.PI * 2);
      context.fill();
    } else if (effort > 0.3) {
      // Shocked awakening (eyes popping wide open)
      const shockH = lerp(0.05, 0.11, (effort - 0.3) / 0.4) * blink;
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.ellipse(ex, ey, 0.09, Math.max(0.02, shockH), 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      context.fillStyle = '#4a1d30';
      context.beginPath();
      context.arc(ex, ey, 0.04, 0, Math.PI * 2);
      context.fill();
    } else {
      // Drowsy heavy-lidded eyes (half-closed sleepy curve)
      context.beginPath();
      context.moveTo(ex - 0.09, ey);
      context.quadraticCurveTo(ex, ey - 0.07 * blink, ex + 0.09, ey);
      context.stroke();

      context.beginPath();
      context.arc(ex, ey + 0.02, 0.035, 0, Math.PI);
      context.fill();
    }
  }
  context.restore();

  // Mouth
  context.save();
  context.strokeStyle = '#4a1d30';
  context.fillStyle = '#681a32';
  context.lineWidth = 0.045;
  context.lineCap = 'round';

  const mouthY = 0.23 + tremble;
  if (relief > 0.4) {
    // Gentle sleepy breath curve
    context.beginPath();
    context.moveTo(-0.08, mouthY);
    context.quadraticCurveTo(0, mouthY + 0.05, 0.08, mouthY);
    context.stroke();
  } else if (effort > 0.25) {
    // Wide puffed 'O' mouth holding back air
    const mouthRadius = lerp(0.04, 0.09, (effort - 0.25) / 0.75);
    context.beginPath();
    context.arc(0, mouthY, mouthRadius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else {
    // Small sleepy content mouth 'u'
    context.beginPath();
    context.moveTo(-0.06, mouthY);
    context.quadraticCurveTo(0, mouthY + 0.04, 0.06, mouthY);
    context.stroke();
  }
  context.restore();

  // Cartoon sweat droplets flying off side
  drawSweatDrop(context, -0.38, -0.18, 1.1, effort * (1 - relief), timeMs);
  drawSweatDrop(context, 0.39, -0.22, 0.9, effort * (1 - relief) * 0.8, timeMs);
}

// ----------------------------------------------------------------------
// CHARACTER 2: Mischievous / Winking (장난꾸러기 - 팡팡이)
// Cheeky wink & cat smirk morphing into fierce determined cheek puff
// ----------------------------------------------------------------------
function drawWinkFace(
  context: CanvasRenderingContext2D,
  timeMs: number,
  seed: number,
  motion: BalloonFaceMotion,
): void {
  const effort = getCharacterEffort(motion);
  const relief = motion.settlingProgress;
  const blink = blinkOpenness(timeMs, seed);
  const tremble = Math.sin(timeMs * 0.038 + seed) * effort * motion.windStrength * 0.012;

  // Cheeks with cheeky glow
  const cheekR = lerp(0.075, 0.13, effort);
  context.save();
  context.fillStyle = '#ff4d5a';
  context.globalAlpha = lerp(0.4, 0.8, effort);
  context.beginPath();
  context.arc(-0.31, 0.19, cheekR, 0, Math.PI * 2);
  context.arc(0.31, 0.19, cheekR, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // Eyebrows (Slanted sharp V-shape brows)
  context.save();
  context.strokeStyle = '#432036';
  context.lineWidth = 0.045;
  context.lineCap = 'round';
  const browAngle = lerp(-0.03, 0.08, effort);
  for (const side of [-1, 1]) {
    const bx = side * 0.2;
    const by = -0.19 + browAngle * side;
    context.beginPath();
    context.moveTo(bx - side * 0.07, by - side * browAngle);
    context.lineTo(bx + side * 0.07, by + side * browAngle);
    context.stroke();
  }
  context.restore();

  // Eyes (Left open, Right wink, morphing into fierce squint)
  context.save();
  context.strokeStyle = '#432036';
  context.fillStyle = '#432036';
  context.lineWidth = 0.045;
  context.lineCap = 'round';

  const ey = 0.01 + tremble;

  if (relief > 0.4) {
    // Victory wink
    context.beginPath();
    context.arc(-0.2, ey, 0.08, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(0.12, ey);
    context.quadraticCurveTo(0.2, ey - 0.05, 0.28, ey);
    context.stroke();
  } else if (effort > 0.65) {
    // Intense determined double squint ( > < )
    for (const side of [-1, 1]) {
      const ex = side * 0.2;
      context.beginPath();
      context.moveTo(ex - side * 0.07, ey - 0.05);
      context.lineTo(ex + side * 0.01, ey);
      context.lineTo(ex - side * 0.07, ey + 0.05);
      context.stroke();
    }
  } else {
    // Left eye open
    const leftH = lerp(0.11, 0.06, effort / 0.65) * blink;
    context.beginPath();
    context.ellipse(-0.2, ey, 0.085, Math.max(0.01, leftH), 0, 0, Math.PI * 2);
    context.fill();
    if (leftH > 0.04) {
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(-0.22, ey - leftH * 0.3, 0.024, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#432036';
    }

    // Right eye wink
    const winkLift = lerp(-0.04, -0.01, effort / 0.65);
    context.beginPath();
    context.moveTo(0.12, ey + winkLift);
    context.quadraticCurveTo(0.2, ey - 0.06 + winkLift, 0.28, ey + winkLift);
    context.stroke();
  }
  context.restore();

  // Mouth (Cat smirk morphing into tight pucker / tongue out)
  context.save();
  context.strokeStyle = '#432036';
  context.fillStyle = '#651c32';
  context.lineWidth = 0.042;
  context.lineCap = 'round';

  const mouthY = 0.23 + tremble;
  if (relief > 0.4) {
    // Winking victory tongue out :P
    context.beginPath();
    context.moveTo(-0.1, mouthY);
    context.quadraticCurveTo(0, mouthY + 0.06, 0.1, mouthY);
    context.stroke();
    context.fillStyle = '#ff6b81';
    context.beginPath();
    context.arc(0.03, mouthY + 0.03, 0.035, 0, Math.PI * 2);
    context.fill();
  } else if (effort > 0.75) {
    // Tight squiggly pucker
    context.beginPath();
    context.moveTo(-0.08, mouthY);
    context.quadraticCurveTo(-0.04, mouthY - 0.03, 0, mouthY);
    context.quadraticCurveTo(0.04, mouthY + 0.03, 0.08, mouthY);
    context.stroke();
  } else if (effort > 0.3) {
    // Air holding pucker mouth '3'
    context.beginPath();
    context.arc(0, mouthY, lerp(0.035, 0.07, (effort - 0.3) / 0.45), 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else {
    // Cat smirk :3
    context.beginPath();
    context.moveTo(-0.12, mouthY - 0.02);
    context.quadraticCurveTo(-0.06, mouthY + 0.04, 0, mouthY - 0.01);
    context.quadraticCurveTo(0.06, mouthY + 0.04, 0.12, mouthY - 0.02);
    context.stroke();
  }
  context.restore();

  // Sweat Drop
  drawSweatDrop(context, 0.36, -0.22, 1.0, effort * (1 - relief), timeMs);
}

// ----------------------------------------------------------------------
// CHARACTER 3: Sparkly / Anime Star (반짝반짝 - 세라)
// Twinkling star eyes morphing into spinning dizzy spiral eyes at max effort!
// ----------------------------------------------------------------------
function drawStarryFace(
  context: CanvasRenderingContext2D,
  timeMs: number,
  seed: number,
  motion: BalloonFaceMotion,
): void {
  const effort = getCharacterEffort(motion);
  const relief = motion.settlingProgress;
  const blink = blinkOpenness(timeMs, seed);
  const tremble = Math.sin(timeMs * 0.036 + seed) * effort * motion.windStrength * 0.012;
  const spinAngle = timeMs * 0.006 + seed;

  // Cheeks (High pastel pink blush)
  const cheekR = lerp(0.07, 0.12, effort);
  context.save();
  context.fillStyle = '#ff60a8';
  context.globalAlpha = lerp(0.35, 0.75, effort);
  context.beginPath();
  context.arc(-0.3, 0.16, cheekR, 0, Math.PI * 2);
  context.arc(0.3, 0.16, cheekR, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // Eyebrows (High delicate arches)
  context.save();
  context.strokeStyle = '#482039';
  context.lineWidth = 0.035;
  context.lineCap = 'round';
  for (const side of [-1, 1]) {
    const bx = side * 0.2;
    const by = -0.19 - lerp(0, 0.03, effort);
    context.beginPath();
    context.moveTo(bx - side * 0.07, by);
    context.quadraticCurveTo(bx, by - 0.05, bx + side * 0.07, by);
    context.stroke();
  }
  context.restore();

  // Eyes (Single pass)
  context.save();
  context.strokeStyle = '#482039';
  context.fillStyle = '#482039';
  context.lineWidth = 0.04;
  context.lineCap = 'round';

  for (const side of [-1, 1]) {
    const ex = side * 0.2;
    const ey = 0.01 + tremble;

    if (relief > 0.4) {
      // Peaceful closed eyes with floating sparkles
      context.beginPath();
      context.arc(ex, ey + 0.02, 0.07, Math.PI * 1.1, Math.PI * 1.9);
      context.stroke();

      // Sparkle accent
      context.fillStyle = '#fbbf24';
      context.beginPath();
      context.arc(ex + side * 0.09, ey - 0.04, 0.018, 0, Math.PI * 2);
      context.fill();
    } else if (effort > 0.7) {
      // Spinning dizzy spiral eyes (@ @)!
      context.beginPath();
      context.arc(ex, ey, 0.1, 0, Math.PI * 2);
      context.stroke();

      context.save();
      context.translate(ex, ey);
      context.rotate(spinAngle * side);
      context.lineWidth = 0.025;
      context.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.2) {
        const r = 0.01 + a * 0.016;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (a === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.stroke();
      context.restore();
    } else {
      // Sparkly anime eyes with 4-point star specular
      const eyeH = lerp(0.105, 0.06, effort / 0.7) * blink;
      context.beginPath();
      context.ellipse(ex, ey, 0.09, Math.max(0.01, eyeH), 0, 0, Math.PI * 2);
      context.fill();

      if (eyeH > 0.035) {
        // 4-point star highlight
        context.save();
        context.translate(ex - 0.02, ey - eyeH * 0.25);
        context.rotate(timeMs * 0.001 * side);
        context.fillStyle = '#ffffff';
        context.beginPath();
        const rOuter = 0.032;
        const rInner = 0.01;
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          const radius = i % 2 === 0 ? rOuter : rInner;
          const sx = Math.cos(angle) * radius;
          const sy = Math.sin(angle) * radius;
          if (i === 0) context.moveTo(sx, sy);
          else context.lineTo(sx, sy);
        }
        context.closePath();
        context.fill();
        context.restore();
      }
    }
  }
  context.restore();

  // Mouth
  context.save();
  context.strokeStyle = '#482039';
  context.fillStyle = '#6b1a3e';
  context.lineWidth = 0.04;
  context.lineCap = 'round';

  const mouthY = 0.23 + tremble;
  if (relief > 0.4) {
    // Happy relaxed mouth
    context.beginPath();
    context.arc(0, mouthY, 0.05, 0, Math.PI);
    context.stroke();
  } else if (effort > 0.3) {
    // Trembling open gasp 'O'
    const openR = lerp(0.04, 0.085, (effort - 0.3) / 0.7);
    context.beginPath();
    context.ellipse(0, mouthY, openR * 0.8, openR, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else {
    // Tiny button mouth 'o'
    context.beginPath();
    context.arc(0, mouthY, 0.035, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  // Sweat Drop
  drawSweatDrop(context, 0.37, -0.21, 1.0, effort * (1 - relief), timeMs);
}

// ----------------------------------------------------------------------
// CHARACTER 4: Flustered / Blushing (새침/안절부절 - 수줍이)
// Shy blush stripes (///) morphing into flustered ( > ﹏ < ) cheek puff
// ----------------------------------------------------------------------
function drawFlusteredFace(
  context: CanvasRenderingContext2D,
  timeMs: number,
  seed: number,
  motion: BalloonFaceMotion,
): void {
  const effort = getCharacterEffort(motion);
  const relief = motion.settlingProgress;
  const blink = blinkOpenness(timeMs, seed);
  const tremble = Math.sin(timeMs * 0.042 + seed) * effort * motion.windStrength * 0.015;

  // Cheeks (Heavy deep rose blush + blushing stripes ///)
  const cheekR = lerp(0.085, 0.15, effort);
  context.save();
  context.fillStyle = '#ff4760';
  context.globalAlpha = lerp(0.45, 0.85, effort);
  context.beginPath();
  context.arc(-0.3, 0.18, cheekR, 0, Math.PI * 2);
  context.arc(0.3, 0.18, cheekR, 0, Math.PI * 2);
  context.fill();

  // Diagonal blush lines ///
  context.strokeStyle = '#dc2626';
  context.lineWidth = 0.02;
  context.globalAlpha = 0.7;
  for (const side of [-1, 1]) {
    const cx = side * 0.3;
    for (let i = -1; i <= 1; i++) {
      const lx = cx + i * 0.03;
      context.beginPath();
      context.moveTo(lx - 0.015, 0.15);
      context.lineTo(lx + 0.015, 0.21);
      context.stroke();
    }
  }
  context.restore();

  // Eyebrows (Anxious inward-slanting brows \ /)
  context.save();
  context.strokeStyle = '#432036';
  context.lineWidth = 0.042;
  context.lineCap = 'round';
  for (const side of [-1, 1]) {
    const bx = side * 0.2;
    const by = -0.18 + lerp(0, 0.03, effort) * side;
    context.beginPath();
    context.moveTo(bx - side * 0.07, by + side * 0.03);
    context.quadraticCurveTo(bx, by - 0.02, bx + side * 0.07, by - side * 0.03);
    context.stroke();
  }
  context.restore();

  // Eyes (Single pass)
  context.save();
  context.strokeStyle = '#432036';
  context.fillStyle = '#432036';
  context.lineWidth = 0.045;
  context.lineCap = 'round';

  for (const side of [-1, 1]) {
    const ex = side * 0.2;
    const ey = 0.01 + tremble;

    if (relief > 0.4) {
      // Relieved blushing eyes
      context.beginPath();
      context.arc(ex, ey + 0.02, 0.065, Math.PI * 1.15, Math.PI * 1.85);
      context.stroke();
    } else if (effort > 0.55) {
      // Tightly squeezed crying/straining eyes ( > ﹏ < )
      context.beginPath();
      context.moveTo(ex - side * 0.07, ey - 0.05);
      context.lineTo(ex + side * 0.01, ey);
      context.lineTo(ex - side * 0.07, ey + 0.05);
      context.stroke();
    } else {
      // Wide timid oval eyes
      const eyeH = lerp(0.11, 0.06, effort / 0.55) * blink;
      context.beginPath();
      context.ellipse(ex, ey, 0.075, Math.max(0.01, eyeH), 0, 0, Math.PI * 2);
      context.fill();

      if (eyeH > 0.04) {
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(ex - 0.02, ey - eyeH * 0.3, 0.022, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#432036';
      }
    }
  }
  context.restore();

  // Mouth (Wavy helpless mouth ﹏ morphing into air-filled squiggly open mouth)
  context.save();
  context.strokeStyle = '#432036';
  context.fillStyle = '#5b1732';
  context.lineWidth = 0.042;
  context.lineCap = 'round';

  const mouthY = 0.24 + tremble;
  if (relief > 0.4) {
    // Embarrassed smile
    context.beginPath();
    context.moveTo(-0.08, mouthY);
    context.quadraticCurveTo(0, mouthY + 0.06, 0.08, mouthY);
    context.stroke();
  } else if (effort > 0.4) {
    // Wavy squiggly open mouth holding back air
    const mouthW = lerp(0.06, 0.09, (effort - 0.4) / 0.6);
    const mouthH = lerp(0.03, 0.07, (effort - 0.4) / 0.6);
    context.beginPath();
    context.ellipse(0, mouthY, mouthW, mouthH, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else {
    // Wavy mouth ~
    context.beginPath();
    context.moveTo(-0.09, mouthY);
    context.quadraticCurveTo(-0.045, mouthY - 0.03, 0, mouthY);
    context.quadraticCurveTo(0.045, mouthY + 0.03, 0.09, mouthY);
    context.stroke();
  }
  context.restore();

  // Strain Cues (Stress Mark 💢 & Sweat Drop)
  drawStressMark(context, -0.35, -0.22, 1.0, effort * (1 - relief));
  drawSweatDrop(context, 0.38, -0.2, 1.0, effort * (1 - relief), timeMs);
}

// ----------------------------------------------------------------------
// MAIN ENTRY POINT
// ----------------------------------------------------------------------
export function drawBalloonFace(
  context: CanvasRenderingContext2D,
  timeMs: number,
  seed: number,
  faceId: number,
  motion: BalloonFaceMotion,
): void {
  const character = ((faceId % 5 + 5) % 5) as BalloonFaceCharacter;
  switch (character) {
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
