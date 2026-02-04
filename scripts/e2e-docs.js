import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const OUTPUT_DIR = join(process.cwd(), 'docs', 'assets');
const OUTPUT_WEBM = join(OUTPUT_DIR, 'glassine-demo.webm');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function record() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  const videoDir = join(process.cwd(), 'tmp', 'videos');
  const context = await browser.newContext({
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 },
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
}

record().catch((err) => {
  console.error(err);
  process.exit(1);
});
