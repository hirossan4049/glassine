import { test, expect } from '@playwright/test';

test('トップページからイベント作成導線が表示される', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Glassine' })).toBeVisible();
  await expect(page.getByRole('button', { name: '新しいイベントを作成' })).toBeVisible();

  await page.getByRole('button', { name: '新しいイベントを作成' }).click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByRole('button', { name: '戻る' })).toBeVisible();
});
