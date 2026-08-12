import { createBalloonBody } from '../game/balloons/createBalloon';
import { drawBalloon } from '../game/balloons/drawBalloon';
import { preloadBalloonAssets } from '../game/balloons/balloonAssets';
import type { BalloonBody, GameResult } from '../game/types';
import { APP_THEME } from '../styles/theme';
import { formatSeconds } from '../utils/math';

const SNAPSHOT_WIDTH = 1080;
const SNAPSHOT_HEIGHT = 1350;

function drawSnapshotBalloon(
  context: CanvasRenderingContext2D,
  source: BalloonBody,
  x: number,
  y: number,
  radius: number,
): void {
  const balloon = createBalloonBody(source.variant, x, y, radius);
  balloon.completed = source.completed;
  balloon.rotation = source.rotation;
  const isRelieved = (source.variant.seed % 3) === 0;
  drawBalloon(context, balloon, performance.now(), 1, 0, {
    growthProgress: 0,
    windStrength: 0,
    settlingProgress: isRelieved ? 1 : 0,
  });
}

export async function createResultSnapshot(
  result: GameResult,
): Promise<string> {
  await preloadBalloonAssets();
  const canvas = document.createElement('canvas');
  canvas.width = SNAPSHOT_WIDTH;
  canvas.height = SNAPSHOT_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('결과 이미지를 만들지 못했어요.');

  const background = context.createLinearGradient(0, 0, 0, SNAPSHOT_HEIGHT);
  background.addColorStop(0, APP_THEME.paper);
  background.addColorStop(0.55, APP_THEME.paper);
  background.addColorStop(1, APP_THEME.paperDeep);
  context.fillStyle = background;
  context.fillRect(0, 0, SNAPSHOT_WIDTH, SNAPSHOT_HEIGHT);

  context.fillStyle = APP_THEME.ink;
  context.textAlign = 'center';
  context.font = '700 46px system-ui, sans-serif';
  context.fillText('blow-balloon', SNAPSHOT_WIDTH / 2, 82);

  if (result.mode === 'lung-test') {
    drawSnapshotBalloon(
      context,
      result.balloon,
      SNAPSHOT_WIDTH / 2,
      600,
      Math.min(330, 160 + result.finalBalloonScale * 34),
    );
    context.font = '800 72px system-ui, sans-serif';
    context.fillText('풍선 크게 불기', SNAPSHOT_WIDTH / 2, 180);
    context.font = '800 90px system-ui, sans-serif';
    context.fillStyle = APP_THEME.ink;
    context.fillText(
      `한 번에 ${formatSeconds(result.durationMs)}초!`,
      SNAPSHOT_WIDTH / 2,
      1120,
    );
    context.font = '700 42px system-ui, sans-serif';
    context.fillStyle = APP_THEME.inkSoft;
    context.fillText(
      `풍선 크기 ${Math.round(result.finalBalloonScale * 100)}점`,
      SNAPSHOT_WIDTH / 2,
      1200,
    );
  } else {
    result.balloons.slice(0, 24).forEach((balloon, index) => {
      const columns = 6;
      const row = Math.floor(index / columns);
      const column = index % columns;
      drawSnapshotBalloon(
        context,
        balloon,
        115 + column * 170 + (row % 2) * 25,
        270 + row * 165,
        76,
      );
    });
    context.font = '800 72px system-ui, sans-serif';
    context.fillStyle = APP_THEME.ink;
    context.fillText('풍선 스피드런', SNAPSHOT_WIDTH / 2, 180);
    context.font = '800 78px system-ui, sans-serif';
    context.fillStyle = APP_THEME.ink;
    context.fillText(
      result.completionTimeMs === null
        ? `30초 동안 ${result.completedCount}개 완성!`
        : `${result.completedCount}개 · ${formatSeconds(result.completionTimeMs)}초`,
      SNAPSHOT_WIDTH / 2,
      1160,
    );
    context.font = '700 42px system-ui, sans-serif';
    context.fillStyle = APP_THEME.inkSoft;
    context.fillText(
      result.completionTimeMs === null
        ? '30초 안에 목표에 도달하지 못했어요'
        : '마지막 풍선까지 걸린 시간',
      SNAPSHOT_WIDTH / 2,
      1230,
    );
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('결과 이미지를 만들지 못했어요.'));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, 'image/png');
  });
}
