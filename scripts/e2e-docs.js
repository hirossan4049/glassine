import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const OUTPUT_DIR = join(process.cwd(), 'docs', 'assets');
const OUTPUT_WEBM = join(OUTPUT_DIR, 'glassine-demo.webm');
const OUTPUT_GIF = join(OUTPUT_DIR, 'glassine-demo.gif');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });

async function convertWebmToGif(inputPath, outputPath) {
  if (!ffmpegPath) throw new Error('ffmpeg binary not found (ffmpeg-static not installed?)');
  const palettePath = join(OUTPUT_DIR, 'palette.png');
  const filter = 'fps=12,scale=1920:-1:flags=lanczos';

  await run(ffmpegPath, ['-y', '-i', inputPath, '-vf', `${filter},palettegen`, palettePath]);
  await run(ffmpegPath, [
    '-y',
    '-i',
    inputPath,
    '-i',
    palettePath,
    '-lavfi',
    `${filter} [x]; [x][1:v] paletteuse=dither=bayer`,
    outputPath,
  ]);
}

async function record() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  const videoDir = join(process.cwd(), 'tmp', 'videos');
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1920, height: 1080 },
    },
  });
  const page = await context.newPage();

  console.log(`Navigating to ${BASE_URL} …`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await pause(500);

  await page.getByRole('button', { name: '新しいイベントを作成' }).click();
  await page.waitForLoadState('networkidle');
  await pause(500);

  await page.getByLabel('イベント名').fill('デモイベント');
  await pause(200);
  await page.getByLabel('説明').fill('ドキュメント用デモ');
  await pause(400);

  // Select a few available date cells (skip disabled past days)
  const selectableKeys = await page.$$eval('[data-key]', (nodes) =>
    nodes
      .filter((n) => getComputedStyle(n).cursor !== 'not-allowed')
      .slice(0, 3)
      .map((n) => n.getAttribute('data-key'))
  );
  for (const key of selectableKeys) {
    await page.locator(`[data-key="${key}"]`).click();
    await pause(150);
  }
  await pause(600);

  // Select some time slots (first few visible cells in the time grid)
  const timeKeys = await page.$$eval('[data-key]', (nodes) =>
    nodes
      .map((n) => n.getAttribute('data-key'))
      .filter((k) => {
        if (!k) return false;
        const parts = k.split('-');
        return parts.length === 3 && parts.every((p) => /^\d+$/.test(p) && p.length <= 2);
      })
      .slice(0, 6)
  );
  if (timeKeys.length === 0) {
    throw new Error('Time grid did not render (no time slots found)');
  }
  for (const key of timeKeys) {
    await page.locator(`[data-key="${key}"]`).click();
    await pause(120);
  }
  await pause(800);

  await page.getByRole('button', { name: 'イベントを作成' }).click();
  // In local preview there may be no backend, so just wait for UI to settle visibly
  await page.waitForTimeout(2500);

  const video = page.video();
  if (!video) {
    throw new Error('Video was not recorded');
  }
  await context.close(); // ensure video is flushed to disk
  const videoPath = await video.path();
  if (!existsSync(videoPath)) {
    throw new Error(`Video file not found at ${videoPath}`);
  }
  await browser.close();

  copyFileSync(videoPath, OUTPUT_WEBM);
  console.log(`Recording saved: ${OUTPUT_WEBM}`);

  await convertWebmToGif(OUTPUT_WEBM, OUTPUT_GIF);
  console.log(`GIF saved: ${OUTPUT_GIF}`);
}

record().catch((err) => {
  console.error(err);
  process.exit(1);
});
