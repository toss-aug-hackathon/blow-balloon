import { useEffect, useRef } from 'react';
import type { DetectorFrame } from '../audio/blowDetector';
import { BalloonEngine } from './BalloonEngine';
import type {
  GameHudState,
  GameMode,
  GameResult,
} from './types';

type BalloonCanvasProps = {
  mode: GameMode;
  signalRef: React.RefObject<DetectorFrame>;
  onHudChange: (hud: GameHudState) => void;
  onFinish: (result: GameResult) => void;
  onInterrupted: () => void;
};

export function BalloonCanvas({
  mode,
  signalRef,
  onHudChange,
  onFinish,
  onInterrupted,
}: BalloonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BalloonEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const engine = new BalloonEngine({
      mode,
      context,
      onHudChange,
      onFinish,
    });
    engineRef.current = engine;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * dpr));
      canvas.height = Math.max(1, Math.round(bounds.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      engine.resize(bounds.width, bounds.height);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    let animationId = 0;
    const animate = (timeMs: number) => {
      engine.update(timeMs, signalRef.current);
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);

    const handleVisibility = () => {
      if (document.hidden) {
        if (mode === 'lung-test' && engine.hasStartedLungBreath()) {
          onInterrupted();
        } else {
          engine.setPaused(true);
        }
      } else {
        engine.setPaused(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      engineRef.current = null;
    };
  }, [mode, onFinish, onHudChange, onInterrupted, signalRef]);

  return <canvas ref={canvasRef} className="balloon-canvas" />;
}
