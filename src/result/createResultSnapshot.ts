import { createBalloonBody } from '../game/balloons/createBalloon';
import { drawBalloon } from '../game/balloons/drawBalloon';
import type { BalloonBody, GameResult } from '../game/types';
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
  drawBalloon(context, balloon, performance.now());
}

export async function createResultSnapshot(
  result: GameResult,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = SNAPSHOT_WIDTH;
  canvas.height = SNAPSHOT_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('결과 이미지를 만들지 못했어요.');

  const background = context.createLinearGradient(0, 0, 0, SNAPSHOT_HEIGHT);
  background.addColorStop(0, '#fff1d7');
  background.addColorStop(0.55, '#fffaf4');
  background.addColorStop(1, '#e7f8ff');
  context.fillStyle = background;
  context.fillRect(0, 0, SNAPSHOT_WIDTH, SNAPSHOT_HEIGHT);

  context.fillStyle = '#4b3542';
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
    context.fillText('폐활량 테스트', SNAPSHOT_WIDTH / 2, 180);
    context.font = '800 90px system-ui, sans-serif';
    context.fillStyle = '#f05465';
    context.fillText(
      `한 번에 ${formatSeconds(result.durationMs)}초!`,
      SNAPSHOT_WIDTH / 2,
      1120,
    );
    context.font = '600 42px system-ui, sans-serif';
    context.fillStyle = '#66515e';
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
    context.fillStyle = '#4b3542';
    context.fillText('풍선 많이 만들기', SNAPSHOT_WIDTH / 2, 180);
    context.font = '800 78px system-ui, sans-serif';
    context.fillStyle = '#f05465';
    context.fillText(
      `60초 동안 풍선 ${result.completedCount}개 완성!`,
      SNAPSHOT_WIDTH / 2,
      1160,
    );
    context.font = '600 42px system-ui, sans-serif';
    context.fillStyle = '#66515e';
    context.fillText(
      `바람을 분 시간 ${formatSeconds(result.totalBlowingMs)}초`,
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
