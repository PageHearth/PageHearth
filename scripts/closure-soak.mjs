// Bounded desktop acceptance, not a substitute for human multi-hour writing.
// Run after build; PAGEHEARTH_EXECUTABLE optionally selects the packaged app.
import { _electron as electron, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { Store } from '../dist-main/main/storage.js';
const base = await fs.mkdtemp(path.join(os.tmpdir(), 'pagehearth-closure-'));
const root = path.join(base, 'Closure Novel');
await fs.mkdir(root);
const store = new Store(root);
let app;
const report = { requestedSeconds: Number(process.env.PAGEHEARTH_SOAK_SECONDS || 300), documents: 350, initialWords: 157500, assetFiles: 200, assetMiB: 50, cycles: 0, backups: 0, reopens: 0, memory: [], errors: [] };
try {
  await store.create('Closure Novel');
  const p = structuredClone(store.project); const firstId = p.manifest.nodes[0].id; p.manifest.nodes = []; p.documents = {};
  for (let i = 0; i < 350; i++) {
    const id = i === 0 ? firstId : randomUUID();
    p.manifest.nodes.push({ id, parent: i === 1 ? p.manifest.nodes[0].id : null, title: `Document ${i}`, kind: i === 1 ? 'Scene' : 'Chapter' });
    p.documents[id] = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'word '.repeat(450) }] }] };
  }
  await store.commit(p); await store.release();
  for (let i = 0; i < 200; i++) await fs.writeFile(path.join(root, 'assets', `asset-${i}.bin`), randomBytes(262144));
  const executablePath = process.env.PAGEHEARTH_EXECUTABLE;
  app = await electron.launch({ ...(executablePath ? { executablePath } : {}), args: [...(executablePath ? [] : ['.']), `--user-data-dir=${path.join(base, 'profile')}`, path.join(root, 'project.pagehearth')] });
  const page = await app.firstWindow(); page.on('pageerror', e => report.errors.push(e.message));
  await expect(page.locator('.brand small')).toHaveText('Closure Novel');
  await page.getByRole('button', { name: 'Collapse Document 0', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Document 1', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'PageHearth Home' }).click();
  await page.locator('.recent-open').click();
  await expect(page.getByRole('button', { name: 'Expand Document 0', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Document 0', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Document 1', exact: true })).toBeVisible();
  report.nestedCollapseRestoration = 'PASS';
  const start = performance.now();
  while (performance.now() - start < report.requestedSeconds * 1000) {
    const index = 2 + report.cycles % 348;
    await page.getByRole('button', { name: `Document ${index}`, exact: true }).click();
    const prose = page.getByRole('textbox', { name: 'Manuscript editor' });
    await expect(page.locator('.page h1')).toHaveText(`Document ${index}`);
    await expect(prose).toHaveAttribute('contenteditable', 'true');
    await prose.click(); await page.keyboard.press('Control+End');
    await page.keyboard.type(` Cycle ${report.cycles}.`, { delay: 15 });
    await expect(prose).toContainText(`Cycle ${report.cycles}.`);
    await page.keyboard.press('Control+s'); await expect(page.locator('footer')).toContainText('Saved');
    if (report.cycles % 5 === 0) {
      await page.getByRole('button', { name: 'Back up now', exact: true }).click();
      await expect(page.locator('.notice')).toContainText('Verified backup saved'); report.backups++;
      await page.getByRole('button', { name: 'PageHearth Home' }).click(); await page.locator('.recent-open').click(); report.reopens++;
      await expect(page.locator('.page h1')).toHaveText(`Document ${index}`);
      await expect(prose).toContainText(`Cycle ${report.cycles}.`);
    }
    const metrics = await app.evaluate(({ app }) => app.getAppMetrics().map(m => ({ type: m.type, workingSetKiB: m.memory.workingSetSize, privateKiB: m.memory.privateBytes })));
    report.memory.push({ seconds: Math.round((performance.now() - start) / 1000), metrics }); report.cycles++;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  report.actualSeconds = Math.round((performance.now() - start) / 1000);
  const closed = app.waitForEvent('close'); await app.evaluate(({ BrowserWindow }) => { setTimeout(() => BrowserWindow.getAllWindows()[0].close(), 20); }); await closed;
  await store.open();
  for (let i = 0; i < report.cycles; i++) expect(JSON.stringify(store.project.documents[p.manifest.nodes[2 + i % 348].id])).toContain(`Cycle ${i}.`);
  await store.release(); expect(report.errors).toEqual([]); report.result = 'PASS';
} catch (e) { report.result = 'FAIL'; report.failure = String(e); process.exitCode = 1; }
finally {
  await app?.close().catch(() => {}); await store.release().catch(() => {});
  await fs.mkdir('.acceptance', { recursive: true }); await fs.writeFile('.acceptance/closure-soak.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, memory: `${report.memory.length} samples in .acceptance/closure-soak.json` }, null, 2));
  if (report.result === 'PASS') await fs.rm(base, { recursive: true, force: true });
  else console.log('Failed disposable fixture retained for diagnosis:', base);
}
