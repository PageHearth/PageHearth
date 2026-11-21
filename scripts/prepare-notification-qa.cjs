// Separate native QA application: no production hooks, settings, project storage or network feed switch.
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{const root=path.resolve('release/qa/update-notification'),app=path.join(root,'app');await fs.mkdir(app,{recursive:true});await fs.cp('node_modules/electron/dist',path.join(root,'runtime'),{recursive:true});await fs.copyFile('release/candidates/in-app-updates/win-unpacked/resources/app.asar',path.join(app,'candidate.asar'));await fs.writeFile(path.join(app,'package.json'),JSON.stringify({name:'pagehearth-notification-qa',version:'1.0.0',main:'main.cjs'}));
await fs.copyFile('scripts/notification-qa-main.cjs',path.join(app,'main.cjs'));await fs.copyFile('scripts/notification-qa-preload.cjs',path.join(app,'preload.cjs'));
const {build}=await import('vite');await build({configFile:false,base:'./',build:{outDir:path.join(app,'ui'),emptyOutDir:true,rollupOptions:{input:path.resolve('e2e/fixtures/updates.html')}},logLevel:'warn'});
await fs.copyFile('scripts/Start-Notification-QA.ps1',path.join(root,'Start-Notification-QA.ps1'));
await fs.copyFile('scripts/notification-qa-paths.cjs',path.join(app,'paths.cjs'));
console.log('Isolated notification QA prepared: '+root);})().catch(e=>{console.error(e);process.exitCode=1;});
