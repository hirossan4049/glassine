import { chromium } from '@playwright/test';
import ffmpegPath from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const OUTPUT_DIR = join(process.cwd(), 'docs', 'assets');
const OUTPUT_GIF = join(OUTPUT_DIR, 'glassine-demo.gif');

async function record() {
  if (!ffmpegPath) {
    throw new Error('ffmpeg not found. Please ensure ffmpeg-static is installed.');
  }

  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  const context = await browser.newContext({
    recordVideo: {
      dir: join(process.cwd(), 'tmp', 'videos'),
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();

  await page.goto(BASE_URL);
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: '新しいイベントを作成' }).click();
  await page.waitForTimeout(300);

  await page.getByLabel('イベント名').fill('デモイベント');
  await page.getByLabel('説明').fill('ドキュメント用デモ');

  const grid = page.locator('.calendar-grid');
  const box = await grid.boundingBox();
  if (box) {
    const startX = box.x + 40;
    const startY = box.y + 40;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 120, startY + 120, { steps: 10 });
    await page.mouse.up();
  }

  await page.getByRole('button', { name: 'イベントを作成' }).click();
  await page.waitForTimeout(1000);

  const videoPath = await context.video().path();
  await browser.close();

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Convert to GIF using ffmpeg
  spawnSync(ffmpegPath, [
    '-y',
    '-i',
    videoPath,
    '-vf',
    'fps=10,scale=640:-1:flags=lanczos',
    OUTPUT_GIF,
  ], { stdio: 'inherit' });

  console.log(`GIF generated at: ${OUTPUT_GIF}`);
}

record().catch((err) => {
  console.error(err);
  process.exit(1);
});
