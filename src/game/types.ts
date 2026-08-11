export type GameMode = 'lung-test' | 'balloon-rush';

export type BalloonShape =
  | 'round'
  | 'oval'
  | 'pear'
  | 'heart'

export type BalloonPalette = {
  id: string;
  light: string;
  base: string;
  dark: string;
};

export type BalloonVariant = {
  shape: BalloonShape;
  paletteId: string;
  seed: number;
};

export type BalloonBody = {
  id: string;
  variant: BalloonVariant;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  angularVelocity: number;
  compressionX: number;
  compressionY: number;
  compressionAngle: number;
  completed: boolean;
  depth: number;
};

export type LungTestResult = {
  mode: 'lung-test';
  durationMs: number;
  averageWindStrength: number;
  peakWindStrength: number;
  finalBalloonScale: number;
  balloon: BalloonBody;
};

export type BalloonRushResult = {
  mode: 'balloon-rush';
  durationMs: 30000;
  completedCount: number;
  totalBlowingMs: number;
  balloons: BalloonBody[];
};

export type GameResult = LungTestResult | BalloonRushResult;

export type GameHudState = {
  elapsedMs: number;
  remainingMs: number;
  completedCount: number;
  windStrength: number;
  isWaitingForBreath: boolean;
};
