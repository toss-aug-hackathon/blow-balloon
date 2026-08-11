import { BALLOON_PALETTES } from './balloonPalette';
import type {
  BalloonBody,
  BalloonShape,
  BalloonVariant,
} from '../types';

export const BALLOON_SHAPES: BalloonShape[] = [
  'round',
  'oval',
  'pear',
  'heart',
];

export function createRandomVariant(
  previous?: BalloonVariant,
  random: () => number = Math.random,
): BalloonVariant {
  let variant: BalloonVariant;
  do {
    const shape =
      BALLOON_SHAPES[Math.floor(random() * BALLOON_SHAPES.length)] ??
      'round';
    const palette =
      BALLOON_PALETTES[Math.floor(random() * BALLOON_PALETTES.length)] ??
      BALLOON_PALETTES[0]!;
    variant = {
      shape,
      paletteId: palette.id,
      seed: Math.floor(random() * 1_000_000),
    };
  } while (
    previous &&
    variant.shape === previous.shape &&
    variant.paletteId === previous.paletteId
  );
  return variant;
}

export function createBalloonBody(
  variant: BalloonVariant,
  x: number,
  y: number,
  radius = 22,
): BalloonBody {
  const proportions: Record<BalloonShape, [number, number]> = {
    round: [1, 1],
    oval: [0.86, 1.16],
    pear: [0.94, 1.12],
    heart: [1.05, 0.98],
  };
  const [width, height] = proportions[variant.shape];
  return {
    id: `${variant.seed}-${performance.now().toFixed(2)}`,
    variant,
    x,
    y,
    vx: 0,
    vy: 0,
    radiusX: radius * width,
    radiusY: radius * height,
    rotation: 0,
    angularVelocity: 0,
    compressionX: 1,
    compressionY: 1,
    compressionAngle: 0,
    completed: false,
    depth: 0.94 + Math.random() * 0.12,
  };
}
