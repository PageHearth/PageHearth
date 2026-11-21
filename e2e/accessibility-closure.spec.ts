import { test, expect, _electron as electron } from '@playwright/test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('primary action text meets contrast in Light, Dark and System themes', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'pagehearth-contrast-'));
  const executablePath = process.env.PAGEHEARTH_EXECUTABLE;
  const app = await electron.launch({ ...(executablePath ? { executablePath } : {}), args: [...(executablePath ? [] : ['.']), `--user-data-dir=${base}`] });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('button',{name:'New Project…',exact:true})).toBeVisible();
    for (const theme of ['Light', 'Dark', 'System']) {
      await page.emulateMedia({ colorScheme: 'dark' });
      await app.evaluate(({BrowserWindow},theme)=>BrowserWindow.getAllWindows()[0].webContents.send('app-command',{kind:'set-theme',theme}),theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
      const ratio = await page.locator('.primary').evaluate(el => {
        const luminance = (color: string) => {
          const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        const s = getComputedStyle(el); const a = luminance(s.color), b = luminance(s.backgroundColor);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      });
      expect(ratio, `${theme} primary button contrast`).toBeGreaterThanOrEqual(4.5);
    }
  } finally { await app.close(); await fs.rm(base, { recursive: true, force: true }); }
});
