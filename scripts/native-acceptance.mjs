// Real packaged UI, no dialog stubs. Keeps the launch process alive for native testing.
import { _electron } from '@playwright/test';
import path from 'node:path';
const profile=path.resolve(process.argv[2] || '.acceptance/pagehearth-native');
const app=await _electron.launch({executablePath:path.resolve('release/win-unpacked/PageHearth.exe'),args:[`--user-data-dir=${profile}`]});
const page=await app.firstWindow();
page.on('pageerror',e=>console.error(e.message));
console.log('Native acceptance window ready:',await page.title());
await app.waitForEvent('close',{timeout:0});
