import {openLicenseInformation} from './licenseInformation.js';
import {chooseRestoreZip} from './restorePicker.js';
import {manualBackup,closeWithBackupConsent} from './backupOutcome.js';
import {PublicationTemporary} from './publicationTemporary.js';
import {themeMenu} from './themeMenu.js';
import {applyWindowChrome,windowChromeCapabilities} from './windowChrome.js';
import {manuscriptImageContextMenu} from './manuscriptImageContextMenu.js';
import {manuscriptClipboard} from './manuscriptClipboard.js';
import {jpegOrientation} from './imageOrientation.js';
import {manuscriptImageDecodeBounds} from './manuscriptImageAssets.js';
import {importManuscriptImage} from './manuscriptImageImport.js';
import {discardUnpublishedManuscriptImage} from './manuscriptImageAssets.js';
import {manuscriptImageAsset} from '../shared/manuscriptImages.js';
import {UpdateService} from './updateService.js';
import {createUpdateAdapter} from './updateAdapter.js';
import {updateCapabilities,validateUpdateRequest} from '../shared/updates.js';
import {inspectCoverCandidate} from './coverSelection.js';
import {writeCoverAsset} from './coverAssets.js';
import {coverWorker,coverHash,inspectCoverInWorker} from './coverProduction.js';
import {coverIdentity,readCovers,type CoverResult} from '../shared/covers.js';
import {editPublication} from '../shared/publication.js';
import {verifiedAsset} from './typstPrint.js';
import {ExportService,exportFingerprint} from './exportService.js';
import {ExternalAccess,ExternalAccessRequired,projectAsset,projectAssetDirectory} from './externalAccess.js';
import {exportSaveDialogOptions,destinationSnapshot,safeExportDestination,saveExport} from './exportFiles.js';
import {exportDocument,type ExportOptions} from '../shared/exportPublication.js';
import {compilePublication} from '../shared/publicationCompiler.js';
import {ThemeSettings} from './themeSettings.js';
import {EbookJobs} from './ebookJobs.js';
import {PrintJobs,PrintWorkerRenderer,printFingerprint,writePrintPdf} from './typstPrint.js';
import {installedPrintFonts,embeddingAllowed} from './printFonts.js';
import {exportFilename} from '../shared/printProduction.js';
import {readPublication} from '../shared/publication.js';
import {defaultThemes,resolveTheme} from '../shared/themes.js';
import {LocalSpellEngine,validateSpellRequest} from './spellEngine.js';
import {saveMenu} from './saveMenu.js';
import {focusMenu} from './focusMenu.js';
import {ProjectTemplateServices} from './projectTemplateServices.js';
import {TemplateWorkflow} from './templateWorkflow.js';
import {ImportWorkflow} from './importWorkflow.js';
import {focusPreferences} from '../shared/focus.js';
let focusView={...focusPreferences(undefined),enabled:false};
import type {SearchRequest} from '../shared/search.js';
import {validFontFamily} from '../shared/fonts.js';
import {invokeReferenceOpen,openReferenceTarget} from './referenceNavigation.js';
import {getFontCatalog} from './fontCatalog.js';
import {editorContextMenu,type ReferenceContext} from './editorContextMenu.js';
import {appCommands,commandBinding,commandForInput,changeBinding,cleanRecent,commandDescriptor} from '../shared/commands.js';
import {WindowStates,windowPlacement} from './windowState.js';
import { nativeTheme, app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, screen, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { promises as fs, existsSync, constants as fsConstants } from 'node:fs';
import {randomUUID} from 'node:crypto';
import { projectRoot, isShellProjectFile } from './projectPaths.js';
import { Store } from './storage.js';
import { readBackup, restoreBackup, readRecovery, restoreRecovery } from './archive.js';
import {firstClipboardPng} from './clipboardMedia.js';
import { validate, type Project } from '../shared/model.js';
import { SettingsStore, projectBrowseDirectory, directoryAvailable, browseDirectory } from './settings.js';
import { BackupSchedule } from './backupSchedule.js';
import { normalizeZoomPercent, zoomStep, zoomShortcut, type ZoomAction, type AppCommand } from '../shared/preferences.js';
import type {ThemeId} from '../shared/preferences.js';
import {RevisionCoordinator, type CoordinatedSave} from './revisionCoordinator.js';
import {DetachedTheme} from './detachedTheme.js';
import {detachedWindowKey,type DetachedSurface} from './detachedIdentity.js';
const here = path.dirname(fileURLToPath(import.meta.url));
app.setName('PageHearth');
let updates:UpdateService;
let win: BrowserWindow; let store: Store | undefined; let exiting = false;
let externalAccess:ExternalAccess;
function localStore(root:string){const next=new Store(root);next.externalAccess=externalAccess;return next;}
function externalScope(purpose:'backup'|'research'){if(!store)throw Error('Open a project first.');return {root:store.root,projectId:store.project.manifest.id,purpose};}
async function closeStore(target:Store){
 return closeWithBackupConsent(target,async()=>{const answer=await dialog.showMessageBox(win,{type:'warning',title:'External backup needs permission',message:'Your saved manuscript is safe. The external backup location has not been authorized on this computer.',detail:'Choose it again in Settings → Project protection. You can close now without creating an external backup; the configured location will be preserved.',buttons:['Keep project open','Close without external backup'],defaultId:0,cancelId:0,noLink:true});return answer.response===1;});
}
let temporarySession:PublicationTemporary|undefined;let temporaryStarting:Promise<void>|undefined;
async function ensurePublicationSession(){if(temporarySession)return;return temporaryStarting??=(async()=>{try{temporarySession=await PublicationTemporary.start(app.getPath('temp'),message=>console.warn(message));}finally{temporaryStarting=undefined;}})();}
let temporarySweep:ReturnType<typeof setInterval>|undefined;
const publicationCalls=new Set<Promise<unknown>>();let publicationClosing=false;
async function retirePublications(quit=false){
 publicationClosing=true;if(quit)clearInterval(temporarySweep);exportService?.cancel();ebookJobs?.cancel();printJobs?.cancel();coverController?.abort();
 try{await Promise.allSettled([...publicationCalls]);await exportService?.dispose();await ebookJobs?.dispose();await temporarySession?.dispose();}
 finally{exportService=undefined;ebookJobs=undefined;printJobs=undefined;lastEbook=undefined;coverResult=undefined;coverInterior=undefined;temporarySession=undefined;if(!quit)publicationClosing=false;}
}
let printJobs:PrintJobs|undefined;
let coverInterior:import('../shared/printProduction.js').PrintProof|undefined;
let coverController:AbortController|undefined,coverResult:CoverResult|undefined;
const coverPending=new Map<string,{projectId:string;bytes:Buffer;extension:string}>();

let ebookJobs:EbookJobs|undefined;
let exportService:ExportService|undefined;
let lastEbook:{documentKey:string;proof:import('../shared/ebookProduction.js').EbookProof}|undefined;
const exportedFiles=new Set<string>();let exportSaving=false;
function exporter(){return exportService??=new ExportService(new PrintWorkerRenderer(app.isPackaged?path.join(process.resourcesPath,'typst'):path.join(app.getAppPath(),'assets','typst'),path.join(temporarySession!.root,'export-print')),new EbookJobs(app.isPackaged?path.join(process.resourcesPath,'epub'):path.join(app.getAppPath(),'assets','epub'),path.join(temporarySession!.root,'export-ebook')));}
function ebook(){return ebookJobs??=new EbookJobs(app.isPackaged?path.join(process.resourcesPath,'epub'):path.join(app.getAppPath(),'assets','epub'),path.join(temporarySession!.root,'ebook'));}
handle('ebook-render',async(p:Project,requestId:string)=>{if(typeof requestId!=='string'||!/^[a-f0-9-]{36}$/.test(requestId))throw Error('Invalid eBook request.');validate(p);const target=store;if(!target||p.manifest.id!==target.project.manifest.id)throw Error('Project changed.');lastEbook=undefined;const result=await ebook().render(p,target.root,requestId);if(store!==target)throw Error('Project changed.');lastEbook={documentKey:exportFingerprint(compilePublication(p,'ebook')),proof:result};return result;},true);
handle('ebook-preview',async(p:Project,requestId:string)=>{if(typeof requestId!=='string'||!/^[a-f0-9-]{36}$/.test(requestId))throw Error('Invalid eBook request.');validate(p);const target=store;if(!target||p.manifest.id!==target.project.manifest.id)throw Error('Project changed.');lastEbook=undefined;const result=await ebook().preview(p,target.root,requestId);if(store!==target)throw Error('Project changed.');return result;},true);
handle('ebook-cancel',async(id:string)=>{if(typeof id==='string'){lastEbook=undefined;await ebookJobs?.cancel(id);}},true);
function printer(){return printJobs??=new PrintJobs(new PrintWorkerRenderer(app.isPackaged?path.join(process.resourcesPath,'typst'):path.join(app.getAppPath(),'assets','typst'),path.join(temporarySession!.root,'print')));}
handle('print-fonts',async()=>{const fonts=await installedPrintFonts();return [{family:'Libertinus Serif',available:true},...Array.from(new Set(fonts.map(f=>f.family))).sort().map(family=>({family,available:fonts.filter(f=>f.family===family).every(f=>embeddingAllowed(f.fsType))}))];},true);
handle('print-render',async(p:Project,requestId:string)=>{if(typeof requestId!=='string'||!/^[a-f0-9-]{36}$/.test(requestId))throw Error('Invalid print request.');validate(p);const target=store;if(!target||p.manifest.id!==target.project.manifest.id)throw Error('Project changed.');const result=await printer().render(p,target.root,requestId);if(store!==target){printer().cancel();throw Error('Project changed.');}coverInterior=result;return result;},true);
handle('print-cancel',async(requestId:string)=>{if(typeof requestId==='string')printJobs?.cancel(requestId);},true);
handle('print-export',async(p:Project,id:string)=>{validate(p);const target=store,proof=printer().proof;if(!target||p.manifest.id!==target.project.manifest.id||!proof||proof.id!==id||proof.projectId!==p.manifest.id||proof.fingerprint!==printFingerprint(p))throw Error('Refresh Proof before exporting.');if(proof.diagnostics.some(i=>i.blocking))throw Error('Resolve blocking print preflight issues before exporting.');const r=await dialog.showSaveDialog(win,{title:'Export Print PDF',defaultPath:exportFilename(readPublication(p).metadata.title),filters:[{name:'Print PDF',extensions:['pdf']}],properties:['showOverwriteConfirmation']});if(r.canceled||!r.filePath)return null;if(store!==target||printer().proof!==proof)throw Error('Project or proof changed.');if(printFingerprint(target.project)!==proof.fingerprint)throw Error('Wait for Saved, then refresh Proof before exporting.');return writePrintPdf(proof,r.filePath,target.root);},true);
handle('export-preferences',async()=>settings.value.exportPreferences||{},true);
handle('export-prepare',async(p:Project,options:ExportOptions,request:string)=>{
 validate(p);if(typeof request!=='string'||!/^[a-f0-9-]{36}$/.test(request))throw Error('Invalid export request.');const target=store;if(!target||p.manifest.id!==target.project.manifest.id)throw Error('Project changed.');
 if(exportFingerprint(exportDocument(p,options))!==exportFingerprint(exportDocument(target.project,options)))throw Error('Wait for Saved before preparing an export.');
 const result=await exporter().prepare(p,target.root,options,request,printer().proof,lastEbook,stage=>{if(store===target&&!win.isDestroyed())win.webContents.send('export-progress',{projectId:p.manifest.id,requestId:request,format:options.format,stage});});if(store!==target){exporter().cancel(result.id);throw Error('Project changed.');}exporter().current(target.project,result.id);
 await settings.update({exportPreferences:{format:options.format,front:options.front,back:options.back,titlePage:options.titlePage}});return result;
},true);
handle('export-cancel',async(id:string)=>{if(typeof id==='string')exportService?.cancel(id);},true);
handle('export-save',async(p:Project,id:string,acknowledged:boolean,attempt:string=id)=>{
 if(typeof attempt!=='string'||!/^[a-f0-9-]{36}$/.test(attempt))throw Error('Invalid export save request.');
 validate(p);if(exportSaving)throw Error('An export Save dialog is already open.');const target=store;if(!target||p.manifest.id!==target.project.manifest.id)throw Error('Project changed.');const service=exporter(),prepared=service.current(p,id);service.current(target.project,id);
 if(prepared.receipt.issues.some(i=>i.blocking))throw Error('Resolve blocking Preflight errors before exporting.');if(prepared.receipt.issues.some(i=>i.severity==='warning')&&acknowledged!==true)throw Error('Review and acknowledge export warnings.');
 const progress=(stage:import('../shared/exportProgress.js').ExportStage,destination?:string)=>{if(store===target&&!win.isDestroyed())win.webContents.send('export-progress',{projectId:p.manifest.id,requestId:attempt,format:prepared.receipt.format,stage,destination});};
 exportSaving=true;try{
 progress('destination');
 const directory=await browseDirectory(settings.value.lastExportDirectory,app.getPath('documents'),app.getPath('home'));
 const result=await dialog.showSaveDialog(win,exportSaveDialogOptions(prepared.receipt,directory||''));
 if(result.canceled||!result.filePath)return null;const file=await safeExportDestination(result.filePath,target.root,prepared.receipt.format),existing=await destinationSnapshot(file);
 if(existing!==null){progress('overwrite',file);const answer=await dialog.showMessageBox(win,{type:'warning',title:'Replace exported file?',message:'Replace '+path.basename(file)+'?',detail:'The existing file will remain intact unless export completes successfully.',buttons:['Cancel','Replace'],defaultId:0,cancelId:0,noLink:true});if(answer.response!==1)return null;}
 const current=()=>{try{return store===target&&service.current(target.project,id)===prepared;}catch{return false;}};
 progress('write',file);const saved=await saveExport(prepared.bytes,prepared.assets,file,target.root,prepared.receipt.format,existing,prepared.controller.signal,current);exportedFiles.add(saved);await settings.update({lastExportDirectory:path.dirname(saved)}).catch(()=>{});return saved;
 }finally{exportSaving=false;}
},true);
handle('export-open',async(file:string,reveal:boolean)=>{if(typeof file!=='string'||!exportedFiles.has(file))throw Error('Export this file before opening it.');if(reveal===true)shell.showItemInFolder(file);else {const error=await shell.openPath(file);if(error)throw Error(error);}},true);
type DetachedWindowEntry={window:BrowserWindow;surface:DetachedSurface;contextId:string;closing:boolean;capturePlacement:()=>void};
const detachedWindows=new Map<string,DetachedWindowEntry>();
type PendingMedia={kind:'file';source:string}|{kind:'clipboard';bytes:Buffer;extension:'.png'};
const pendingMedia=new Map<string,PendingMedia>();
const revisions=new RevisionCoordinator();
const detachedTheme=new DetachedTheme();
let settings: SettingsStore;
let themeSettings:ThemeSettings;
function themeState(surface?:import('./detachedTheme.js').ThemeSurface){return {capabilities:windowChromeCapabilities(process.platform),preferences:settings?.value.themes??defaultThemes(),legacyMigration:!settings?.value.themes,override:surface?detachedTheme.override(surface):undefined};}
function broadcastTheme(){
 const p=settings.value.themes??defaultThemes();detachedTheme.set(p.selected,[]);
 if(win&&!win.isDestroyed()){applyWindowChrome(win,resolveTheme(p,nativeTheme.shouldUseDarkColors),process.platform);win.webContents.send('theme-state',themeState());win.webContents.send('theme-changed',p.selected);}
 for(const item of detachedWindows.values())if(!item.window.isDestroyed()){applyWindowChrome(item.window,resolveTheme(p,nativeTheme.shouldUseDarkColors,detachedTheme.override(item.surface)),process.platform);item.window.webContents.send('theme-state',themeState(item.surface));item.window.webContents.send('theme-changed',detachedTheme.resolve(item.surface));}
 menus();
}
ipcMain.on('theme-snapshot',(event)=>{const detached=detachedEntry(event.sender);const trusted=event.senderFrame===event.sender.mainFrame&&(event.sender===win?.webContents||!!detached);event.returnValue=trusted?themeState(detached?.[1].surface):null;});
handle('themes',async(request:import('../shared/themes.js').ThemeRequest)=>themeSettings.request(request),true);
let templateWorkflow:TemplateWorkflow;
let importWorkflow:ImportWorkflow;
handle('manuscript-import',async(request:import('../shared/manuscriptImport.js').ImportRequest)=>importWorkflow.request(request));
handle('templates',async(request:unknown)=>templateWorkflow.request(request));
// Detached flushes invoke their normal queued save IPC; never wait for them while
// holding that queue. The following template request revalidates project/revision.
handle('prepare-templates',async()=>{for(const item of detachedWindows.values())await item.window.webContents.executeJavaScript('window.__pagehearthFlush?.()');},true);
let windowStates:WindowStates;
function workAreas(){const primary=screen.getPrimaryDisplay();return [primary,...screen.getAllDisplays().filter(d=>d.id!==primary.id)].map(d=>d.workArea);}
let backupSchedule:BackupSchedule|undefined;
let pendingBackup:{store:Store;resolve:()=>void;reject:(error:unknown)=>void;timer:ReturnType<typeof setTimeout>}|undefined;
function stopBackups(){backupSchedule?.stop();backupSchedule=undefined;if(pendingBackup){clearTimeout(pendingBackup.timer);pendingBackup.resolve();pendingBackup=undefined;}}
function scheduleBackups(){
  stopBackups();const target=store!;
  backupSchedule=new BackupSchedule(()=>new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>{if(pendingBackup?.store===target){pendingBackup=undefined;reject(Error('The editor did not finish saving in time. Backup will retry.'));}},60_000);
    pendingBackup={store:target,resolve,reject,timer};command({kind:'backup',projectId:target.project.manifest.id});
  }),e=>dialog.showErrorBox('PageHearth backup could not finish','Your manuscript remains open and saved edits are retained. PageHearth will retry on the configured schedule. '+String(e)),target.project.manifest.settings.backup?.daily?24*60*60*1000:5*60*1000);
  if(target.backupDirty)backupSchedule.changed();
}
const customProfile = app.commandLine.getSwitchValue('user-data-dir');
if (customProfile) app.setPath('userData', path.resolve(customProfile));
// Select compatibility profile before acquiring Electron's singleton lock.
else {const legacy=path.join(app.getPath('appData'),'storyloom');
  if(!existsSync(path.join(app.getPath('userData'),'settings.json')) && existsSync(path.join(legacy,'settings.json')))app.setPath('userData',legacy);
}
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>) { const task = queue.then(fn); queue = task.catch(()=>{}); return task; }
// Urgent is selected only by trusted registration code; all calls retain sender/frame checks.
function handle(name: string, fn: (...args:any[]) => Promise<unknown>, urgent=false) {
  ipcMain.handle(name,(event,...args) => { if(event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw Error('Untrusted window.'); const publication=['ebook-render','ebook-preview','print-render','cover-render','export-prepare'].includes(name);if(publication&&publicationClosing)throw Error('Project is closing.');const invoke=async()=>{if(publication)await ensurePublicationSession();return fn(...args);};const task=urgent ? invoke() : enqueue(invoke);if(publication){publicationCalls.add(task);void task.finally(()=>publicationCalls.delete(task)).catch(()=>{});}return task; });
}
function projectHandle(name:string,fn:(...args:any[])=>Promise<unknown>){
  ipcMain.handle(name,(event,...args)=>{
    const fromMain=event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame;
    const detached=detachedEntry(event.sender);
    const fromDetached=!!detached&&event.senderFrame===detached[1].window.webContents.mainFrame;
    if(!fromMain&&!fromDetached)throw Error('Untrusted project window.');
    return enqueue(()=>fn(...args));
  });
}
let shortcutCapture=false;
handle('shortcut-capture',async(active:boolean)=>{shortcutCapture=active===true;win.webContents.setIgnoreMenuShortcuts(shortcutCapture);},true);
let rendererReady=false;let fileOpening=false;
const pendingFiles:string[]=[];
const command = (value: AppCommand) => {if(value.kind==='settings'||value.kind==='about')value={...value,returnFocusWindowId:value.returnFocusWindowId??BrowserWindow.getFocusedWindow()?.id};if(['new-project','open-project','settings','about'].includes(value.kind)){win.show();win.focus();}win.webContents.send('app-command',value);};
function detachedEntry(sender:Electron.WebContents){return [...detachedWindows.entries()].find(([,value])=>value.window.webContents===sender);}
function broadcastProject(project:Project,exclude?:Electron.WebContents){if(win?.webContents!==exclude)win?.webContents.send('project-updated',project);for(const {window} of detachedWindows.values())if(window.webContents!==exclude)window.webContents.send('project-updated',project);}
async function saveProject(project:Project):Promise<CoordinatedSave>{
  if(!store||project.manifest.id!==store.project.manifest.id)throw Error('Project identity changed.');
  const target=store,generation=target.generation;
  const result=await revisions.save(project,target.project,(candidate,base)=>target.commit(candidate,base));
  // A merged commit can contain additional canonical fields, so Store's exact
  // whole-author comparison may intentionally retain the caller's draft. Retire
  // only evidence that exactly matches the acknowledged caller snapshot; a
  // newer protection record is left untouched.
  await target.retireProtected(project);
  void target.writing.flush().catch(e=>{target.writing.warning=String(e);});
  if(target.generation!==generation)backupSchedule?.changed();
  return result;
}
async function saveRecoveryAndRefresh(owner:BrowserWindow,project:Project){
  if(!store||project.manifest.id!==store.project.manifest.id)throw Error('Project identity changed before recovery.');validate(project);
  const result=await dialog.showSaveDialog(owner,{title:'Save protected edits before refreshing',defaultPath:'PageHearth-recovery.json',filters:[{name:'Readable recovery data',extensions:['json']}]});
  if(result.canceled||!result.filePath)return null;
  await fs.writeFile(result.filePath,JSON.stringify(project,null,2),{flag:'wx'});
  await store.retireProtected(project);
  return structuredClone(store.project);
}
async function closeDetachedWindows(){for(const item of detachedWindows.values()){await item.window.webContents.executeJavaScript('window.__pagehearthFlush?.()');item.capturePlacement();await windowStates.flush();item.closing=true;item.window.destroy();}detachedWindows.clear();}
const spellEngine=new LocalSpellEngine();
ipcMain.handle('spell',async(event,value)=>{if(![win,...[...detachedWindows.values()].map(item=>item.window)].some(w=>w&&!w.isDestroyed()&&w.webContents===event.sender))throw Error('Unknown spelling window.');const request=validateSpellRequest(value);return 'words' in request?spellEngine.check(request.words):spellEngine.suggest(request.word,5);});
app.on('will-quit',()=>spellEngine.dispose());
async function showEditorContextMenu(target:BrowserWindow,params:Pick<Electron.ContextMenuParams,'isEditable'|'selectionText'|'x'|'y'|'editFlags'|'misspelledWord'|'dictionarySuggestions'>){let imageContext:{token:string;image:boolean}|null=null;if(target===win)try{imageContext=await target.webContents.executeJavaScript('window.__pagehearthImageMenu?.('+JSON.stringify(params.x)+','+JSON.stringify(params.y)+')');}catch{}if(target.isDestroyed())return;const imageItems=imageContext?manuscriptImageContextMenu(imageContext.image,action=>{void target.webContents.executeJavaScript('window.__pagehearthImageAction?.('+JSON.stringify(imageContext!.token)+','+JSON.stringify(action)+')').then(valid=>{if(valid&&action==='copy'&&!target.isDestroyed())target.webContents.copy();}).catch(()=>{});}):[];if(imageContext?.image){Menu.buildFromTemplate(imageItems).popup({window:target});return;}if(!params.isEditable&&!params.selectionText&&!imageContext)return;let reference:ReferenceContext=null;try{reference=await target.webContents.executeJavaScript('window.__pagehearthReferenceMenu?.('+JSON.stringify(params.x)+','+JSON.stringify(params.y)+')');}catch{/* A closed or reloading renderer has no reference action. */}if(target.isDestroyed())return;const referenceProjectId=store?.project.manifest.id;let spelling:{token:string;word:string;suggestions:string[]}|null=null;try{spelling=await target.webContents.executeJavaScript('window.__pagehearthSpellingMenu?.('+JSON.stringify(params.x)+','+JSON.stringify(params.y)+')');}catch{}if(target.isDestroyed())return;const action=(kind:'add'|'replace',word?:string)=>{if(spelling)void target.webContents.executeJavaScript('window.__pagehearthSpellingAction?.('+JSON.stringify(spelling.token)+','+JSON.stringify(kind)+','+JSON.stringify(word??null)+')').catch(()=>{});};const items=editorContextMenu({...params,misspelledWord:spelling?.word||'',dictionarySuggestions:spelling?.suggestions||[]},reference,{replace:word=>action('replace',word),dictionary:()=>action('add'),open:id=>{void safeOpenReference(target,id,referenceProjectId);},reference:(kind,token)=>{if(kind==='remove')target.webContents.send('app-command',{kind:'remove-reference',token} satisfies AppCommand);else void target.webContents.executeJavaScript('window.__pagehearthRestoreReferenceSelection?.('+JSON.stringify(token)+')').then(valid=>{if(valid&&!target.isDestroyed())target.webContents.send('app-command',{kind:'add-reference'} satisfies AppCommand);}).catch(()=>{});}});const extra:Electron.MenuItemConstructorOptions[]=[...imageItems];if(target===win){try{const comment=await target.webContents.executeJavaScript('window.__pagehearthCommentMenu?.()');if(comment){extra.push({label:comment.caret?'Add Comment Here':'Add Comment',enabled:!comment.reason,click:()=>command({kind:'comment',action:'add',token:comment.token})});if(comment.reason)extra.push({label:comment.reason,enabled:false});}const scene=await target.webContents.executeJavaScript('window.__pagehearthSceneMenu?.()');if(scene){extra.push({label:'Create Scene from Selection',enabled:!scene.reason,click:()=>command({kind:'create-scene',token:scene.token})});if(scene.reason)extra.push({label:scene.reason,enabled:false});}}catch{/* Renderer changed during menu construction. */}}
 if(target.isDestroyed())return;const spellingEnd=items.findIndex(i=>i.label==='Add to Project Dictionary');items.splice(spellingEnd<0?0:spellingEnd+2,0,...extra);Menu.buildFromTemplate(items).popup({window:target});}
function installContextMenu(target:BrowserWindow){target.webContents.on('context-menu',(_event,params)=>{void showEditorContextMenu(target,params);});}
ipcMain.handle('spell-context',async(event,x,y)=>{const target=BrowserWindow.fromWebContents(event.sender);if(!target||![win,...[...detachedWindows.values()].map(item=>item.window)].includes(target)||!Number.isFinite(x)||!Number.isFinite(y))return;await showEditorContextMenu(target,{isEditable:true,selectionText:'',x,y,misspelledWord:'',dictionarySuggestions:[],editFlags:{canCut:true,canCopy:true,canPaste:true,canSelectAll:true,canUndo:false,canRedo:false,canDelete:true,canEditRichly:true}});});
async function approveRecovery(message:string){const result=await dialog.showMessageBox(win,{type:'warning',title:'Recover manuscript changes',message,buttons:['Cancel','Recover'],defaultId:0,cancelId:0,noLink:true});return result.response===1;}
function receiveFile(file:string){pendingFiles.push(file);deliverFile();}
function deliverFile(){if(rendererReady && !fileOpening && pendingFiles.length){fileOpening=true;command({kind:'open-file',path:pendingFiles.shift()!});}}
const initialFile=process.argv.slice(1).find(arg=>path.isAbsolute(arg) && isShellProjectFile(arg));
if(initialFile)pendingFiles.push(initialFile);
const ownsInstance=app.requestSingleInstanceLock();
if(!ownsInstance)app.quit();
app.on('second-instance',(_event,argv)=>{const file=argv.find(arg=>path.isAbsolute(arg) && isShellProjectFile(arg));if(file)receiveFile(file);if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
app.on('open-file',(event,file)=>{event.preventDefault();receiveFile(file);});
handle('renderer-ready',async()=>{rendererReady=true;deliverFile();for(const item of detachedWindows.values())win.webContents.send('workspace-detached',item.surface,item.contextId);});
handle('open-file-finished',async()=>{fileOpening=false;deliverFile();});
handle('open-project-path',async(input:string)=>{
  if(store)throw Error('Close the current project before opening another.');
  const root=await projectRoot(input);const next=localStore(root);const p=await next.open(approveRecovery);store=next;revisions.reset(p);scheduleBackups();await remember(p,root);return p;
});
async function remember(project: Project, root: string) {
  if(store){store.externalAccess=externalAccess;try{await store.authorizedBackupDirectory();}catch(error){if(error instanceof ExternalAccessRequired)project.recovery.push(error.message);}}
  try{await store?.writing.start();}catch(e){project.recovery.push('Writing activity unavailable; original ledger preserved: '+String(e));}
  try { await settings.remember({title:project.manifest.title,path:root,lastOpened:new Date().toISOString()}); }
  catch { project.recovery.push('The project opened, but recent-project history could not be saved.'); }
  menus();
}
async function changeZoom(action: ZoomAction|number) {
  if(typeof action!=='number'&&!['in','out','reset'].includes(action)) throw Error('Unknown zoom command.');
  const percent = typeof action==='number'?normalizeZoomPercent(action):zoomStep(settings.value.zoomPercent,action);
  await settings.update({zoomPercent:percent});
  win.webContents.setZoomFactor(percent/100);
  win.webContents.send('zoom-changed',percent);
  for(const {window} of detachedWindows.values()){window.webContents.setZoomFactor(percent/100);window.webContents.send('zoom-changed',percent);}
  return percent;
}
function requestZoom(action: ZoomAction) { enqueue(()=>changeZoom(action)).catch(e=>dialog.showErrorBox('Zoom preference could not be saved',String(e))); }
let editorView:'pages'|'continuous'|null=null;
let splitLayout='single',splitLocked=false;
handle('focus-view-state',async(value:unknown,enabled:unknown)=>{if(!value||typeof value!=='object'||!['off','sentence','paragraph'].includes((value as any).text)||typeof (value as any).typewriter!=='boolean'||typeof enabled!=='boolean')throw Error('Invalid Focus view state.');const next={...focusPreferences(value),enabled};if(JSON.stringify(next)!==JSON.stringify(focusView)){focusView=next;menus();}});
handle('editor-layout-state',async(layout:unknown,locked:unknown)=>{if(!['single','side-by-side','stacked'].includes(String(layout))||typeof locked!=='boolean')throw Error('Invalid editor layout');splitLayout=String(layout);splitLocked=locked;menus();});
let continuousScope=false,continuousTitles=true;
handle('manuscript-scope-state',async(continuous:unknown,titles:unknown)=>{if(typeof continuous!=='boolean'||typeof titles!=='boolean')throw Error('Invalid manuscript view.');continuousScope=continuous;continuousTitles=titles;menus();});
handle('editor-view-state',async(view:unknown)=>{if(view!==null&&view!=='pages'&&view!=='continuous')throw Error('Invalid editor view.');editorView=view;menus();});
function menus() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'Project',submenu:[{label:'Backup / Archive',enabled:!!store,submenu:[{label:'Back Up Now',click:()=>command({kind:'backup-now'})},{label:'Verify Backup…',click:()=>command({kind:'verify-backup'})},{label:'Restore Backup from ZIP…',click:()=>command({kind:'restore-backup'})}]},{type:'separator'},{label:'Project Dictionary…',enabled:!!store,click:()=>{win.show();win.focus();command({kind:'project-dictionary'});}},{label:'Import Report…',enabled:!!store&&existsSync(path.join(store.root,'imports/import-report.json')),click:()=>command({kind:'import-report'})},{label:'Save as Project Template…',enabled:!!store,click:()=>command({kind:'save-template'})},{label:'Manage Templates…',click:()=>command({kind:'manage-templates'})},{type:'separator'},{label:'Statistics…',enabled:!!store,click:()=>command({kind:'statistics'})},{label:'Writing Goals…',enabled:!!store,click:()=>command({kind:'writing-goals'})}]},
    {label:'File',submenu:[
      {id:'new-project',label:'New Project…',click:()=>command({kind:'new-project'})},
      {id:'open-project',label:'Open Project…',click:()=>command({kind:'open-project'})},
      {type:'separator'},
      saveMenu(!!store,settings.value.keybindings||{},command),
      {type:'separator'},
      {label:'Open Project Folder…',click:()=>command({kind:'open-folder'})},
      {id:'close-project',label:'Close Project',enabled:!!store,click:()=>command({kind:'home'})},
      {label:'Recent Projects',submenu:settings.value.recentProjects.length ? settings.value.recentProjects.map((r,i)=>({id:`recent-${i}`,label:r.title.replaceAll('&','&&'),sublabel:r.path,click:()=>command({kind:'recent',path:r.path})})) : [{label:'No recent projects',enabled:false}]},
      {type:'separator'},{label:'Exit PageHearth',accelerator:'Alt+F4',click:()=>win.close()}]},
    {label:'Edit',submenu:[{label:'Search Project…',accelerator:commandBinding('search-project'),enabled:!!store,click:()=>{command({kind:'search-project'});win.show();win.focus();}},{id:'edit-undo',label:'Undo',accelerator:'Ctrl+Z',click:()=>command({kind:'undo'})},{id:'edit-redo',label:'Redo',accelerator:'Ctrl+Y',click:()=>command({kind:'redo'})},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    {label:'Manuscript',submenu:[{label:'Add Comment',enabled:!!store,click:()=>command({kind:'comment',action:'add',anchorKind:'range'})},{label:'Add Comment Here',enabled:!!store,click:()=>command({kind:'comment',action:'add',anchorKind:'caret'})},{label:'Create Scene from Selection',enabled:!!store,click:()=>command({kind:'create-scene'})}]},
    {label:'History',submenu:appCommands.filter(c=>c.group==='History').map(c=>({label:c.label,enabled:!!store,click:()=>{command({kind:c.id as 'take-snapshot'|'browse-history'});win.show();win.focus();}}))},
    {label:'Format',submenu:[...(['left','center','right'] as const).map(alignment=>({label:'Align '+alignment[0].toUpperCase()+alignment.slice(1),enabled:!!store,click:()=>command({kind:('align-'+alignment) as 'align-left'|'align-center'|'align-right'})})),{type:'separator'},{label:'First-line Indent (Tab)',enabled:!!store,click:()=>command({kind:'indent'})},{label:'First-line Outdent (Shift+Tab)',enabled:!!store,click:()=>command({kind:'outdent'})}]},
    {label:'View',submenu:[...focusMenu(focusView,!!store&&focusView.enabled,command),{label:'Focus Mode',accelerator:'F8',enabled:!!store,click:()=>command({kind:'focus-mode'})},{label:'Editor Layout',submenu:[...([{id:'editor-single',label:'Single Editor',layout:'single'},{id:'editor-side-by-side',label:'Split Side by Side',layout:'side-by-side'},{id:'editor-stacked',label:'Split Stacked',layout:'stacked'}] as const).map(item=>({label:item.label,type:'radio' as const,checked:splitLayout===item.layout,enabled:!!store,click:()=>command({kind:item.id})})),{type:'separator'},...appCommands.filter(c=>c.id.startsWith('editor-')&&!['editor-single','editor-side-by-side','editor-stacked'].includes(c.id)).map(c=>({label:c.label,enabled:!!store&&splitLayout!=='single'&&(c.id==='editor-lock'?!splitLocked:c.id==='editor-unlock'?splitLocked:true),click:()=>command({kind:c.id as 'editor-focus-other'|'editor-lock'|'editor-unlock'|'editor-close-pane'})}))]},{label:'Manuscript Scope',submenu:[{label:'Single Document',type:'radio',checked:!continuousScope,enabled:!!store,click:()=>command({kind:'single-document'})},{label:'Continuous Manuscript',type:'radio',checked:continuousScope,enabled:!!store,click:()=>command({kind:'continuous-selection'})},{label:'Entire Manuscript',enabled:!!store,click:()=>command({kind:'continuous-all'})}]},{label:'Continuous Manuscript',submenu:[{label:'Show Document Titles',type:'checkbox',checked:continuousTitles,enabled:!!store,click:()=>command({kind:'continuous-titles'})}]},{label:'Enter Editor (F6)',enabled:!!store,click:()=>command({kind:'enter-editor'})},{label:'Editor View',submenu:([{view:'pages',label:'Page View'},{view:'continuous',label:'Continuous View'}] as const).map(item=>({id:'editor-view-'+item.view,label:item.label,type:'radio' as const,checked:editorView===item.view,enabled:!!store,click:()=>command({kind:'editor-view',view:item.view})}))},
      {id:'zoom-in',label:'Zoom In',accelerator:commandBinding('zoom-in'),click:()=>requestZoom('in')},
      {id:'zoom-out',label:'Zoom Out',accelerator:commandBinding('zoom-out'),click:()=>requestZoom('out')},
      {id:'zoom-reset',label:'Reset Zoom to 100%',accelerator:commandBinding('zoom-reset'),click:()=>requestZoom('reset')},
      {type:'separator'},{id:'quicknotes',label:'QuickNotes',accelerator:commandBinding('quicknotes',settings.value.keybindings),enabled:!!store,click:()=>command({kind:'quicknotes'})},
      {label:'Theme',submenu:themeMenu(settings.value.themes??defaultThemes(),command)},
      {role:'togglefullscreen'}]},
    {label:'Insert',submenu:[{label:'Insert Image…',enabled:!!store,click:()=>command({kind:'insert-image'})},{label:'Paste Image',enabled:!!store,click:()=>command({kind:'paste-image'})},{label:'Image properties…',enabled:!!store,click:()=>command({kind:'image-properties'})}]},
    {label:'Tools',submenu:[{id:'settings',label:'Settings…',click:()=>command({kind:'settings'})},{label:'Command Palette…',accelerator:commandBinding('command-palette',settings.value.keybindings)||undefined,click:()=>{const target=BrowserWindow.getFocusedWindow()||win;target.webContents.send('app-command',{kind:'command-palette'});}},{label:'Project Maintenance',submenu:[{id:'rebuild-index',label:'Rebuild Project Index…',enabled:!!store,click:()=>command({kind:'rebuild'})}]}]},
    {label:'Help',submenu:[{label:'Check for Updates…',click:()=>{win.show();win.focus();win.webContents.send('show-updates');void updates.check();}},{id:'about',label:'About PageHearth',click:()=>command({kind:'about'})},{id:'keyboard-shortcuts',label:'Keyboard Shortcuts…',click:()=>{win.show();win.focus();command({kind:'shortcuts'});}}]},
  ]));
}
handle('set-keybinding',async(id:string,value:string|null)=>{const next=changeBinding(settings.value.keybindings||{},id,value);await settings.update({keybindings:next});menus();for(const window of BrowserWindow.getAllWindows())window.webContents.send('settings-changed',settings.value);return settings.value;});
handle('favorite-font',async(family:string,favorite:boolean)=>{if(!validFontFamily(family)||typeof favorite!=='boolean')throw Error('Invalid font preference.');const next=await settings.favoriteFont(family,favorite);win.webContents.send('settings-changed',next);return next.favoriteFonts||[];},true);
handle('recent-font',async(family:string)=>{if(!validFontFamily(family))throw Error('Invalid font preference.');const next=await settings.recentFont(family);for(const window of BrowserWindow.getAllWindows())window.webContents.send('settings-changed',next);return next.recentFonts||[];},true);
handle('font-catalog',async()=>getFontCatalog());
handle('restore-shell-focus',async(id:unknown)=>{const target=typeof id==='number'?[...detachedWindows.values()].find(item=>item.window.id===id&&!item.closing)?.window:undefined;const owner=target&&!target.isDestroyed()?target:win;if(!owner.isDestroyed()){if(owner.isMinimized())owner.restore();owner.show();owner.focus();}},true);
handle('open-license-information',async()=>openLicenseInformation(process.resourcesPath,file=>shell.openPath(file),app.isPackaged?undefined:path.join(app.getAppPath(),'dist-legal')));
handle('app-info',async()=>({name:app.getName(),version:app.getVersion()}));
handle('updates',async(request:unknown)=>{validateUpdateRequest(request);if(request.action==='check')await updates.check();else if(request.action==='download'||request.action==='github')await updates.open(request.action);else if(request.action==='automatic')await updates.automatic(request.enabled);return updates.getState();},true);
handle('flush-detached',async()=>{for(const item of detachedWindows.values())await item.window.webContents.executeJavaScript('window.__pagehearthFlush?.()');},true);
handle('app-state',async()=>({settings:settings.value,warning:settings.warning}));
handle('theme',async(theme:ThemeId)=>{await themeSettings.request({action:'select',id:theme});return theme;},true);
handle('native-history',async(action:string)=>{if(action==='undo')win.webContents.undo();else if(action==='redo')win.webContents.redo();else throw Error('Unknown history action.');});
handle('confirm-delete',async(count:number)=>{const r=await dialog.showMessageBox(win,{type:'warning',title:'Delete from project Trash',message:`Permanently delete ${count} selected item(s) and their descendants?`,detail:'This removes their manuscript files. Existing backups are retained. This cannot be undone in the editor.',buttons:['Cancel','Delete permanently'],defaultId:0,cancelId:0,noLink:true});return r.response===1;});
handle('remove-recent',async(root:string)=>{const result=await settings.remove(root);menus();return result;});
handle('zoom',changeZoom);
handle('project-edited',async(id:string)=>{if(store?.project.manifest.id===id)backupSchedule?.changed();});
projectHandle('choose-entity-media',async()=>{
  if(!store)throw Error('Open a project before adding media.');
  const choice=await dialog.showOpenDialog(win,{title:'Choose a World Bible image',properties:['openFile'],filters:[{name:'Images',extensions:['png','jpg','jpeg','webp','gif']}]});
  if(choice.canceled)return null;const source=choice.filePaths[0],bytes=await fs.readFile(source);if(bytes.length>50*1024*1024)throw Error('Choose an image smaller than 50 MiB.');
  const token=randomUUID();pendingMedia.set(token,{kind:'file',source});const ext=path.extname(source).toLowerCase(),mime=ext==='.png'?'image/png':ext==='.webp'?'image/webp':ext==='.gif'?'image/gif':'image/jpeg';return {token,dataUrl:`data:${mime};base64,${bytes.toString('base64')}`};
});
projectHandle('paste-entity-media',async()=>{
  if(!store)throw Error('Open a project before adding media.');
  const bytes=await firstClipboardPng(await clipboard.read(),raw=>{const image=nativeImage.createFromBuffer(raw);return image.isEmpty()?Buffer.alloc(0):image.toPNG();});if(!bytes?.length)return null;if(bytes.length>50*1024*1024)throw Error('The clipboard image is larger than 50 MiB.');
  const token=randomUUID();pendingMedia.set(token,{kind:'clipboard',bytes,extension:'.png'});return {token,dataUrl:`data:image/png;base64,${bytes.toString('base64')}`};
});
projectHandle('discard-entity-media',async(token:string)=>{if(typeof token!=='string')throw Error('Invalid temporary image token.');pendingMedia.delete(token);});
projectHandle('commit-entity-media',async(token:string)=>{
  if(!store||typeof token!=='string'||!pendingMedia.has(token))throw Error('The selected image is no longer available. Choose it again.');
  const pending=pendingMedia.get(token)!;pendingMedia.delete(token);const ext=pending.kind==='file'?path.extname(pending.source).toLowerCase():pending.extension;if(!['.png','.jpg','.jpeg','.webp','.gif'].includes(ext))throw Error('Unsupported image type.');
  await projectAssetDirectory(store.root,'world-bible');const relative=`assets/world-bible/${randomUUID()}${ext}`,target=path.join(store.root,...relative.split('/'));await fs.mkdir(path.dirname(target),{recursive:true});if(pending.kind==='file')await fs.copyFile(pending.source,target,fsConstants.COPYFILE_EXCL);else await fs.writeFile(target,pending.bytes,{flag:'wx'});const bytes=await fs.readFile(target),mime=ext==='.png'?'image/png':ext==='.webp'?'image/webp':ext==='.gif'?'image/gif':'image/jpeg';return {path:relative,dataUrl:`data:${mime};base64,${bytes.toString('base64')}`};
});
projectHandle('read-project-asset',async(relative:string)=>{
  if(!store||typeof relative!=='string'||relative.includes('\\')||relative.split('/').some(part=>!part||part==='.'||part==='..')||!relative.startsWith('assets/world-bible/'))throw Error('Unsafe project asset path.');
  const file=await projectAsset(store.root,relative),bytes=await fs.readFile(file);if(bytes.length>50*1024*1024)throw Error('Image is too large to preview.');const ext=path.extname(file).toLowerCase(),mime=ext==='.png'?'image/png':ext==='.webp'?'image/webp':ext==='.gif'?'image/gif':'image/jpeg';return `data:${mime};base64,${bytes.toString('base64')}`;
});
function researchFileInfo(file:string){const ext=path.extname(file).toLowerCase(),type:'pdf'|'image'|'text'|'file'=ext==='.pdf'?'pdf':['.png','.jpg','.jpeg','.webp','.gif','.bmp','.svg'].includes(ext)?'image':['.txt','.md','.rtf'].includes(ext)?'text':'file';const mime=ext==='.pdf'?'application/pdf':ext==='.png'?'image/png':ext==='.jpg'||ext==='.jpeg'?'image/jpeg':ext==='.webp'?'image/webp':ext==='.gif'?'image/gif':ext==='.svg'?'image/svg+xml':ext==='.txt'||ext==='.md'?'text/plain':'application/octet-stream';return {ext,type,mime};}
async function importResearchPaths(paths:string[],external:boolean,chosen=false){
  if(!store||!Array.isArray(paths)||!paths.length||paths.some(value=>typeof value!=='string'||!path.isAbsolute(value)))throw Error('Choose one or more Research files.');const sources=[] as Array<{type:'pdf'|'image'|'text'|'file';title:string;ownership:'project'|'external';assetPath?:string;externalPath?:string;originalFilename:string;mime:string;size:number}>,created:string[]=[],temporaryFiles:string[]=[];
  try{for(const source of paths){if(chosen)await externalAccess.authorize(externalScope('research'),source);await externalAccess.require(externalScope('research'),source);const stat=await fs.stat(source);if(!stat.isFile())throw Error(`${path.basename(source)} is not a file.`);const info=researchFileInfo(source),originalFilename=path.basename(source),title=path.basename(source,path.extname(source));if(external){sources.push({type:info.type,title,ownership:'external',externalPath:await fs.realpath(source),originalFilename,mime:info.mime,size:stat.size});continue;}await projectAssetDirectory(store.root,'research');const safeExt=/^\.[a-z0-9]{1,12}$/u.test(info.ext)?info.ext:'',relative=`assets/research/${randomUUID()}${safeExt}`,target=path.join(store.root,...relative.split('/')),temporary=`${target}.importing`;temporaryFiles.push(temporary);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,temporary,fsConstants.COPYFILE_EXCL);await fs.rename(temporary,target);temporaryFiles.splice(temporaryFiles.indexOf(temporary),1);created.push(target);sources.push({type:info.type,title,ownership:'project',assetPath:relative,originalFilename,mime:info.mime,size:stat.size});}return sources;}catch(error){await Promise.allSettled([...temporaryFiles,...created].map(file=>fs.unlink(file)));throw error;}
}
projectHandle('choose-research-files',async(external:boolean)=>{const choice=await dialog.showOpenDialog(win,{title:external?'Link External Research Files':'Import Research into Project',properties:['openFile','multiSelections']});if(choice.canceled)return [];return importResearchPaths(choice.filePaths,external===true,true);});
projectHandle('import-research-paths',async(paths:string[],external:boolean)=>{if(!Array.isArray(paths)||paths.some(p=>typeof p!=='string')||paths.length>100)throw Error('Invalid Research files.');const answer=await dialog.showMessageBox(win,{type:'question',message:'Allow PageHearth to access these Research files?',detail:paths.join('\n'),buttons:['Cancel','Allow access'],defaultId:0,cancelId:0,noLink:true});return answer.response===1?importResearchPaths(paths,external===true,true):[];});
projectHandle('locate-research-file',async()=>{const choice=await dialog.showOpenDialog(win,{title:'Locate Research source',properties:['openFile']});if(choice.canceled)return null;return (await importResearchPaths(choice.filePaths,true,true))[0];});
projectHandle('copy-research-into-project',async(externalPath:string)=>{if(typeof externalPath!=='string'||!path.isAbsolute(externalPath))throw Error('External source path is invalid.');return (await importResearchPaths([externalPath],false))[0];});
async function researchSource(itemId:string){if(!store)throw Error('Open a project first.');const item=store.project.author.research?.items.find(value=>value.id===itemId);if(!item||!['project','external'].includes(item.ownership))throw Error('Research source is missing.');const file=item.ownership==='project'?await projectAsset(store.root,item.assetPath!):await externalAccess.require(externalScope('research'),item.externalPath!);return {item,file};}
projectHandle('research-source-status',async(itemId:string)=>{try{const {file}=await researchSource(itemId);return {exists:existsSync(file),path:file,previewUrl:pathToFileURL(file).href};}catch(error){if(error instanceof ExternalAccessRequired)return {exists:false,path:'',previewUrl:'',authorizationRequired:true};throw error;}});
projectHandle('read-research-source',async(itemId:string)=>{const {item,file}=await researchSource(itemId),bytes=await fs.readFile(file);if(bytes.length>150*1024*1024)throw Error('This source is too large for the embedded preview. Use Open Externally.');const mime=item.mime||researchFileInfo(file).mime;return `data:${mime};base64,${bytes.toString('base64')}`;});
projectHandle('open-research-source',async(itemId:string)=>{const {file}=await researchSource(itemId);if(!existsSync(file))throw Error('Source Missing. Locate the file or copy a replacement into the project.');const error=await shell.openPath(file);if(error)throw Error(error);});
projectHandle('open-external-url',async(url:string)=>{if(typeof url!=='string'||!/^https?:\/\//iu.test(url))throw Error('Only http and https links can be opened.');await shell.openExternal(url);});
projectHandle('delete-research-asset',async(relative:string)=>{if(!store||typeof relative!=='string'||!/^assets\/research\/[a-z0-9._-]+$/iu.test(relative))throw Error('Unsafe Research asset path.');if(JSON.stringify(store.project).includes(JSON.stringify(relative)))return false;const file=await projectAsset(store.root,relative);await fs.unlink(file).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});return true;});
handle('choose',async (create: boolean, title: string, folder=false) => {
  const expected=store;
  const defaultPath = await projectBrowseDirectory(create ? settings.value.lastCreateDirectory : settings.value.lastOpenDirectory,app.getPath('documents'),app.getPath('home'));
  const selected = await dialog.showOpenDialog(win,{title:create?'Choose an empty project folder':folder?'Open PageHearth or legacy project folder':'Open PageHearth project',defaultPath,properties:create?['openDirectory','createDirectory']:folder?['openDirectory']:['openFile'],...(!create && !folder?{filters:[{name:'PageHearth project',extensions:['pagehearth']},{name:'Legacy project',extensions:['json']}]}:{})});
  if(selected.canceled) return null;
  if(store!==expected)throw Error('Project changed while browsing. Retry Open.');
  await closeDetachedWindows();
  return enqueue(async()=>{
  if(store!==expected)throw Error('Project changed while browsing. Retry Open.');
  const root=await projectRoot(selected.filePaths[0]);
  await settings.update(create ? {lastCreateDirectory:path.dirname(root)} : {lastOpenDirectory:root});
  const next = localStore(root);
  if(store && next.root === store.root) return store.project;
  const project = create ? await next.create(title) : await next.open(approveRecovery);
  try { if(store && !await closeStore(store)){await next.release();return null;} } catch(e) { await next.release(); throw e; }
  await retirePublications();exportedFiles.clear();store = next;revisions.reset(project);scheduleBackups(); await remember(project,next.root); return project;
  });
},true);
handle('open-recent',async(root:string)=>{
  if(store) throw Error('Close the current project before opening a recent project.');
  if(!settings.value.recentProjects.some(r=>r.path===root)) throw Error('This project is no longer in recent history. Use Open Project to locate it.');
  root=await projectRoot(root).catch(()=>{throw Error('This project folder is missing or unavailable. Reconnect the drive, use Open Project to locate it, or remove this recent entry.');});
  if(!await directoryAvailable(root)) throw Error('This project folder is missing or unavailable. Reconnect the drive, use Open Project to locate it, or remove this recent entry.');
  const next=localStore(root);const project=await next.open(approveRecovery);store=next;revisions.reset(project);scheduleBackups();await remember(project,next.root);return project;
});
function historyTarget(projectId:string){if(!store||store.project.manifest.id!==projectId)throw Error('Project changed.');return store;}
ipcMain.handle('palette-detached',(event,id:string)=>{const source=BrowserWindow.fromWebContents(event.sender);if(!source||(source!==win&&!detachedEntry(event.sender))||event.senderFrame!==event.sender.mainFrame)throw Error('Untrusted project window.');return enqueue(async()=>{if(['new-project','open-project','settings','about'].includes(id)){if(id==='settings'||id==='about')command({kind:id,returnFocusWindowId:source.id});else command({kind:id as 'new-project'|'open-project'});return {status:'opened'};}if(id==='search-project'){command({kind:'search-project'});win.show();win.focus();return {status:'opened'};}if(['zoom-in','zoom-out','zoom-reset'].includes(id)){await changeZoom(id==='zoom-in'?'in':id==='zoom-out'?'out':'reset');return {status:'completed'};}return {status:'refused',reason:'Use this command in the main window.'};});});
projectHandle('palette-settings',async()=>settings.value);
projectHandle('palette-recent',async(id:string)=>{const c=commandDescriptor(id);if(!c||c.palette==='hidden'||c.safety==='destructive')throw Error('Invalid recent command');const next=await settings.update(current=>({recentCommands:cleanRecent([id,...(current.recentCommands||[])])}));return next.recentCommands;});
projectHandle('history-open',async(id:string,take:boolean)=>{command({kind:'document-history',id,take:take===true});win.show();win.focus();});
handle('history-boundary',async(pid:string,id:string)=>historyTarget(pid).historyBoundary(id));
handle('history-list',async(pid:string,id:string)=>{const target=historyTarget(pid),list=await target.history.list(id);if(target.historyWarning)list.warnings.push(target.historyWarning);return list;});
handle('history-read',async(pid:string,id:string,version:string)=>historyTarget(pid).history.read(id,version));
handle('history-capture',async(pid:string,id:string,body:Project['documents'][string],label:string,note:string,title?:string)=>{const result=await historyTarget(pid).history.capture(id,body,'manual',label,note,Date.now(),title);backupSchedule?.changed();return result;});
handle('history-edit',async(pid:string,id:string,version:string,label:string,note:string,promote:boolean)=>{await historyTarget(pid).history.edit(id,version,label,note,promote===true);backupSchedule?.changed();});
handle('history-delete',async(pid:string,id:string,version:string)=>{await historyTarget(pid).history.remove(id,version);backupSchedule?.changed();});
handle('history-retention',async(pid:string,retention:any)=>{await historyTarget(pid).history.configure(retention);backupSchedule?.changed();});
handle('history-restore',async(pid:string,id:string,version:string,body:Project['documents'][string])=>{const result=await historyTarget(pid).history.prepareRestore(id,version,body);backupSchedule?.changed();return result;});
handle('prepare-scene',async()=>{for(const item of detachedWindows.values())await item.window.webContents.executeJavaScript('window.__pagehearthFlush?.()');return enqueue(async()=>{if(!store)throw Error('Open a project first.');return structuredClone(store.project);});},true);
handle('clear-revision',async(projectId,revision,slot)=>{if(!store)throw Error('Open a project first.');const result=await store.clearRevision(projectId,revision,slot);revisions.remember(result.project);backupSchedule?.changed();broadcastProject(result.project,win.webContents);return result;});
handle('revision-history',async(projectId,revision,id,direction)=>{if(!store)throw Error('Open a project first.');const result=await store.revisionHistory(projectId,revision,id,direction);revisions.remember(result.project);backupSchedule?.changed();broadcastProject(result.project,win.webContents);return result;});
handle('create-scene',async(request:import('../shared/sceneSelection.js').SceneSelection)=>{
  if(!store)throw Error('Open a project first.');const result=await store.createScene(request);revisions.remember(result.project);backupSchedule?.changed();broadcastProject(result.project,win.webContents);return result;
});
handle('scene-history',async(projectId:string,revision:number,id:string,direction:'undo'|'redo')=>{
  if(!store)throw Error('Open a project first.');const result=await store.traverseScene(projectId,revision,id,direction);revisions.remember(result.project);backupSchedule?.changed();broadcastProject(result.project,win.webContents);return result;
});
handle('save',async (p: Project) => {const result=await saveProject(p);broadcastProject(result.project,win.webContents);return result;});
// Writing records use their own queue/file; never wait behind backup compression.
let statisticsView:import('../shared/writingStatistics.js').StatisticsSnapshot|null=null;
ipcMain.handle('writing-statistics',(event,value?:import('../shared/writingStatistics.js').StatisticsSnapshot)=>{trustedSearch(event);if(value){if(event.sender!==win.webContents||value.projectId!==store?.project.manifest.id)throw Error('Untrusted statistics source.');statisticsView=value;detachedWindows.get('goals')?.window.webContents.send('writing-statistics',value);}return statisticsView?.projectId===store?.project.manifest.id?statisticsView:null;});
ipcMain.handle('writing-read',async(event,id:string)=>{trustedSearch(event);return (async()=>{const target=historyTarget(id);const value=await target.writing.read();if(target.writing.warning)throw Error(target.writing.warning);return value;})();});
ipcMain.handle('writing-change',async(event,id:string,action:import('../shared/writing.js').WritingAction)=>{trustedSearch(event);const next=await historyTarget(id).writing.change(action);detachedWindows.get('goals')?.window.setAlwaysOnTop(!!next.alwaysOnTop);backupSchedule?.changed();return next;});
handle('writing-contribution',async(id:string,value:any)=>historyTarget(id).writing.contribution(value),true);
handle('writing-add',async(id:string,added:number,removed:number)=>historyTarget(id).writing.add(added,removed),true);
ipcMain.on('writing-interaction',event=>{const target=BrowserWindow.fromWebContents(event.sender);const trusted=target===win||!!detachedEntry(event.sender);if(trusted&&target?.isFocused()&&event.senderFrame===event.sender.mainFrame){store?.writing.touch();if(store)backupSchedule?.changed();}});
app.on('browser-window-blur',()=>{store?.writing.focus(false);});
handle('protect-document',async(projectId:string,id:string,document:any,comments?:import('../shared/comments.js').CommentsState,beforeComments?:import('../shared/comments.js').CommentsState)=>{if(!store || projectId!==store.project.manifest.id)throw Error('Project identity changed before editor protection.');await store.stageDocument(id,document,comments,beforeComments);},true);
handle('protect-author',async(projectId:string,author:Project['author'],before?:Project['author'])=>{if(!store || projectId!==store.project.manifest.id)throw Error('Project identity changed before Author Workspace protection.');await store.stageAuthor(author,before);},true);
handle('active-manuscript-document',async(projectId:string,id:string)=>{if(!store||store.project.manifest.id!==projectId||typeof id!=='string'||!store.project.documents[id])return;for(const entry of detachedWindows.values())if(entry.surface==='inspector'){entry.contextId=id;entry.window.webContents.send('detached-context',id);}});
handle('detach-workspace',async(surface:DetachedSurface,contextId:string)=>{
  if(!store||!['inspector','corkboard','outliner','notebook','character','research','collections','timeline','goals'].includes(surface)||typeof contextId!=='string')throw Error('Cannot detach this workspace.');
  const targetEntity=surface==='character'?store.project.author.worldBible?.entities.find(item=>item.id===contextId&&!item.trashed):undefined;if(surface==='character'&&!targetEntity)throw Error('Cannot detach a missing World Bible entity.');
  if(surface==='research'&&contextId&&!store.project.author.research?.items.some(item=>item.id===contextId&&!item.trashed))throw Error('Cannot detach a missing Research item.');
  const key=detachedWindowKey(surface,store.project.manifest.id,contextId,targetEntity?.type),existing=detachedWindows.get(key);if(existing){if(surface==='goals'){existing.contextId=contextId;existing.window.webContents.send('detached-context',contextId);}existing.window.show();existing.window.focus();win.webContents.send('workspace-detached',surface,existing.contextId);return;}
  const icon=app.isPackaged?path.join(process.resourcesPath,'branding/PageHearth_App_Icon.ico'):path.join(app.getAppPath(),'assets/branding/pagehearth/PageHearth_App_Icon.ico');
  const surfaceTitle=surface==='character'?(targetEntity?.name||'World Bible'):surface==='research'?'Research':surface==='goals'?'Writing Statistics and Goals':surface[0].toUpperCase()+surface.slice(1);
  const alwaysOnTop=surface==='goals'?!!(await store.writing.read()).alwaysOnTop:surface==='research'&&!!settings.value.researchKeepOnTop?.[store.project.manifest.id];
  const placementKey=`detached:${store.project.manifest.id}:${surface}`,savedPlacement=settings.value.windowStates?.[placementKey],placement=windowPlacement(savedPlacement,surface,workAreas());
  const child=new BrowserWindow({...placement,show:false,backgroundColor:resolveTheme(settings.value.themes??defaultThemes(),nativeTheme.shouldUseDarkColors).tokens.appBackground,title:`PageHearth · ${surfaceTitle}`,icon,alwaysOnTop,webPreferences:{preload:path.join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,plugins:true,spellcheck:false}});
  applyWindowChrome(child,resolveTheme(settings.value.themes??defaultThemes(),nativeTheme.shouldUseDarkColors,detachedTheme.override(surface)),process.platform);
  const capturePlacement=windowStates.bind(child,placementKey,placement,savedPlacement);
  if(savedPlacement?.maximized)child.maximize();if(savedPlacement?.fullscreen)child.setFullScreen(true);child.show();
  const item:DetachedWindowEntry={window:child,surface,contextId,closing:false,capturePlacement};detachedWindows.set(key,item);installContextMenu(child);child.webContents.on('before-input-event',(event,input)=>{if(commandForInput(input,settings.value.keybindings)==='command-palette'){event.preventDefault();child.webContents.send('app-command',{kind:'command-palette'});}});child.webContents.setWindowOpenHandler(()=>({action:'deny'}));child.webContents.on('will-navigate',event=>event.preventDefault());child.on('close',event=>{if(!item.closing){event.preventDefault();child.webContents.send('detached-close-request');}});child.on('closed',()=>{const registered=[...detachedWindows.entries()].find(([,value])=>value===item);if(registered){detachedWindows.delete(registered[0]);win.webContents.send('workspace-docked',surface,item.contextId);}});await child.loadFile(path.join(here,'../../dist/index.html'),{query:{detached:surface}});
  child.webContents.setZoomFactor(settings.value.zoomPercent/100);
  win.webContents.send('workspace-detached',surface,contextId);
});
ipcMain.handle('detached-state',event=>{const entry=detachedEntry(event.sender);if(!entry||event.senderFrame!==entry[1].window.webContents.mainFrame||!store)throw Error('Untrusted detached window.');return {surface:entry[1].surface,contextId:entry[1].contextId,project:store.project,theme:detachedTheme.resolve(entry[1].surface),alwaysOnTop:entry[1].surface==='research'&&entry[1].window.isAlwaysOnTop()};});
ipcMain.handle('detached-save',(event,p:Project)=>{const entry=detachedEntry(event.sender);if(!entry||event.senderFrame!==entry[1].window.webContents.mainFrame)throw Error('Untrusted detached window.');const sender=event.sender;return enqueue(async()=>{const result=await saveProject(p);broadcastProject(result.project,sender);return result;});});
ipcMain.handle('detached-protect-author',(event,projectId:string,author:Project['author'],before?:Project['author'])=>{const entry=detachedEntry(event.sender);if(!entry||event.senderFrame!==entry[1].window.webContents.mainFrame||!store||projectId!==store.project.manifest.id)throw Error('Untrusted detached protection request.');return store.stageAuthor(author,before);});
ipcMain.handle('detached-set-context',(event,id:string)=>{const entry=detachedEntry(event.sender),target=store?.project.author.worldBible?.entities.find(item=>item.id===id&&!item.trashed);if(!entry||entry[1].surface!=='character'||event.senderFrame!==entry[1].window.webContents.mainFrame||typeof id!=='string'||!store||!target)throw Error('Untrusted detached World Bible navigation request.');const targetKey=detachedWindowKey('character',store.project.manifest.id,id,target.type),existing=detachedWindows.get(targetKey);if(existing&&existing.window!==entry[1].window){existing.window.show();existing.window.focus();entry[1].window.webContents.send('detached-context',entry[1].contextId);return entry[1].contextId;}const previous=entry[1].contextId;detachedWindows.delete(entry[0]);entry[1].contextId=id;detachedWindows.set(targetKey,entry[1]);if(previous!==id){win.webContents.send('workspace-docked','character',previous);win.webContents.send('workspace-detached','character',id);}return id;});
async function safeOpenReference(owner:BrowserWindow,id:string,projectId:string|undefined){
 await invokeReferenceOpen(id,{
 valid:()=>!owner.isDestroyed()&&!owner.webContents.isDestroyed()&&!win.isDestroyed()&&!win.webContents.isDestroyed()&&!!projectId&&store?.project.manifest.id===projectId,
 report:error=>{console.error('PageHearth reference navigation failed',error);if(!owner.isDestroyed())void dialog.showMessageBox(owner,{type:'error',title:'Open Reference',message:'Could not open the reference. Your manuscript is unchanged.'}).catch(error=>console.error('Reference error feedback failed',error));},
 open:targetId=>openReferenceTarget(store?.project,targetId,{
 unavailable:async message=>{await dialog.showMessageBox(owner,{type:'info',title:'Open Reference',message,detail:'The visible wording and reference are unchanged. You can still remove the reference.'});},
 bringDetached:targetId=>{const existing=[...detachedWindows.values()].find(item=>!item.window.isDestroyed()&&item.surface==='character'&&item.contextId===targetId);if(!existing)return false;existing.window.show();existing.window.focus();return true;},
 openEntity:targetId=>{win.webContents.send('detached-open','entity',targetId);win.show();win.focus();}
 })
 });
}
function trustedSearch(event:Electron.IpcMainInvokeEvent){const owner=event.sender===win.webContents?win:detachedEntry(event.sender)?.[1].window;if(!owner||event.senderFrame!==owner.webContents.mainFrame)throw Error('Untrusted Search request.');}
ipcMain.handle('search-project',event=>{trustedSearch(event);if(store){command({kind:'search-project'});win.show();win.focus();}});
ipcMain.handle('search-snapshots',async event=>{trustedSearch(event);if(event.sender!==win.webContents)throw Error('Search belongs to the main project window.');return Promise.all([...detachedWindows.values()].map(async item=>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([item.window.webContents.executeJavaScript('window.__pagehearthSearchSnapshot?.()'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Detached Search snapshot timed out.')),1500);})]);}finally{clearTimeout(timer);}})).then(values=>values.filter(Boolean));});
ipcMain.handle('search-route',(event,request:SearchRequest)=>{trustedSearch(event);if(!store||event.sender!==win.webContents||!request?.target||typeof request.target.id!=='string')throw Error('Invalid Search navigation.');const t=request.target,surface=t.kind==='note'?'notebook':t.kind==='entity'?'character':t.kind==='research'?'research':t.kind==='collection'?'collections':t.kind==='event'||t.kind==='track'?'timeline':t.kind==='card'?'corkboard':'';const existing=[...detachedWindows.values()].find(e=>e.surface===surface&&(surface!=='character'||e.contextId===t.id));if(!existing)return false;existing.window.webContents.send('search-navigate',request);existing.window.show();existing.window.focus();return true;});
ipcMain.handle('open-timeline',async(event,id:string)=>{
 const owner=event.sender===win.webContents?win:detachedEntry(event.sender)?.[1].window;
 if(!owner||event.senderFrame!==owner.webContents.mainFrame||typeof id!=='string'||!store?.project.author.timeline?.events.some(e=>e.id===id))throw Error('Timeline Event is missing or unavailable.');
 const existing=detachedWindows.get('timeline');if(existing){existing.contextId=id;existing.window.webContents.send('detached-context',id);existing.window.show();existing.window.focus();return;}
 win.webContents.send('detached-open','timeline',id);win.show();win.focus();
});
ipcMain.handle('open-reference',async(event,id:string)=>{
 const owner=!win.isDestroyed()&&event.sender===win.webContents?win:detachedEntry(event.sender)?.[1].window;
 if(!owner||owner.isDestroyed()||event.senderFrame!==owner.webContents.mainFrame)throw Error('Untrusted reference navigation request.');
 await safeOpenReference(owner,id,store?.project.manifest.id);
});
ipcMain.handle('detached-open',(event,type:string,id:string)=>{const entry=detachedEntry(event.sender);if(!entry||event.senderFrame!==entry[1].window.webContents.mainFrame||!['document','note','entity','research'].includes(type)||typeof id!=='string')throw Error('Untrusted detached navigation request.');win.webContents.send('detached-open',type,id);win.show();win.focus();});
ipcMain.handle('detached-always-on-top',async(event,enabled:boolean)=>{const entry=detachedEntry(event.sender);if(!entry||entry[1].surface!=='research'||event.senderFrame!==entry[1].window.webContents.mainFrame||!store||typeof enabled!=='boolean')throw Error('Untrusted detached Research window preference.');entry[1].window.setAlwaysOnTop(enabled);const values={...(settings.value.researchKeepOnTop||{})};if(enabled)values[store.project.manifest.id]=true;else delete values[store.project.manifest.id];await settings.update({researchKeepOnTop:values});return entry[1].window.isAlwaysOnTop();});
ipcMain.handle('dock-workspace',(event,surface:DetachedSurface,contextId?:string)=>{const fromMain=event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame,entry=detachedEntry(event.sender);if(!fromMain&&(!entry||entry[1].surface!==surface))throw Error('Untrusted dock request.');let item:DetachedWindowEntry|undefined;if(entry)item=entry[1];else if(surface==='character'&&store&&contextId){const target=store.project.author.worldBible?.entities.find(value=>value.id===contextId);item=detachedWindows.get(detachedWindowKey(surface,store.project.manifest.id,contextId,target?.type));}else if(surface==='research'&&store)item=detachedWindows.get(detachedWindowKey(surface,store.project.manifest.id,contextId||''));else item=detachedWindows.get(surface);if(item){if(fromMain)item.window.webContents.send('detached-close-request');else{item.closing=true;item.window.close();}}});
ipcMain.handle('detached-resolve-stale',(event,p:Project)=>{const entry=detachedEntry(event.sender);if(!entry||event.senderFrame!==entry[1].window.webContents.mainFrame)throw Error('Untrusted detached recovery request.');const sender=event.sender;return enqueue(async()=>{const project=await saveRecoveryAndRefresh(entry[1].window,p);if(project)broadcastProject(project,sender);return project;});});
handle('backup',async ()=> { if(!store) throw Error('Open a project first.');const generation=backupSchedule?.checkpoint();const result=await store.backup();if(generation!==undefined)backupSchedule?.verified(generation);return result; });
handle('backup-notice',async()=>{if(!store)throw Error('Open a project first.');const target=store,generation=backupSchedule?.checkpoint();return manualBackup(async()=>{const file=await target.backup();if(generation!==undefined)backupSchedule?.verified(generation);return file;});});
handle('backup-settings',async(alternate:boolean|null,daily:boolean)=>{
  if(!store)throw Error('Open a project first.');let directory:string|undefined=alternate===null?store.project.manifest.settings.backup?.directory:undefined;
  if(alternate){const choice=await dialog.showOpenDialog(win,{title:'Choose an alternate local backup folder',properties:['openDirectory','createDirectory']});if(choice.canceled)return null;directory=await externalAccess.authorize(externalScope('backup'),choice.filePaths[0]);const relative=path.relative(await fs.realpath(store.root),directory);if(!relative || (!relative.startsWith('..'+path.sep) && relative!=='..' && !path.isAbsolute(relative)))throw Error('Choose a backup folder outside the project.');}
  const p=structuredClone(store.project);p.manifest.settings.backup={directory,daily:daily===true};const saved=await store.commit(p);revisions.remember(saved);scheduleBackups();broadcastProject(saved,win.webContents);return saved;
});
handle('scheduled-backup',async(id:string,error?:string)=>{
  const pending=pendingBackup;if(!pending || pending.store.project.manifest.id!==id)return;
  pendingBackup=undefined;clearTimeout(pending.timer);
  try{if(error)throw Error(error);if(store===pending.store){const generation=backupSchedule?.checkpoint();await store.backupIfChanged();if(generation!==undefined)backupSchedule?.verified(generation);}pending.resolve();}catch(e){pending.reject(e);}
});
handle('verify',async ()=> { const r = await dialog.showOpenDialog(win,{filters:[{name:'PageHearth backup',extensions:['zip']}],properties:['openFile']}); if(r.canceled) return 'Verification canceled.'; await Store.verifyBackup(r.filePaths[0]); return 'Backup integrity verified.'; });
handle('restore',async()=>{
  const archive=await chooseRestoreZip(settings,store?.root,app.getPath('home'),options=>dialog.showOpenDialog(win,options));
  if(!archive)return 'Restore canceled.';
  const checked=await readBackup(archive);
  const confirm=await dialog.showMessageBox(win,{type:'question',title:'Restore verified backup',message:`Restore ${checked.project.manifest.title}?`,detail:`${checked.project.manifest.nodes.length} documents verified. Choose a parent folder next. A new restored project folder will be created; existing projects will not be overwritten.`,buttons:['Cancel','Choose destination'],defaultId:0,cancelId:0,noLink:true});
  if(confirm.response!==1)return 'Restore canceled.';
  const parent=await dialog.showOpenDialog(win,{title:'Choose a parent folder for the new restored project',properties:['openDirectory','createDirectory']});
  if(parent.canceled)return 'Restore canceled.';
  const destination=await fs.realpath(parent.filePaths[0]);
  if(store){const relative=path.relative(await fs.realpath(store.root),destination);if(!relative || (!relative.startsWith('..'+path.sep) && relative!=='..' && !path.isAbsolute(relative)))throw Error('Choose a destination outside the currently open project.');}
  return 'Verified project restored to '+await restoreBackup(archive,destination)+'. Use Open Project to open it.';
});
handle('import-recovery',async()=>{
  const input=await dialog.showOpenDialog(win,{title:'Import emergency manuscript recovery',filters:[{name:'PageHearth recovery JSON',extensions:['json']}],properties:['openFile']});if(input.canceled)return 'Recovery import canceled.';
  const p=await readRecovery(input.filePaths[0]);
  const confirmation=await dialog.showMessageBox(win,{type:'warning',title:'Recover manuscript copy',message:`Recover ${p.manifest.title} to a new project folder?`,detail:'Emergency JSON contains manuscript and project metadata, not external assets. The original project will remain untouched. Reattach missing assets from the original project or a verified backup.',buttons:['Cancel','Choose destination'],defaultId:0,cancelId:0,noLink:true});if(confirmation.response!==1)return 'Recovery import canceled.';
  const target=await dialog.showOpenDialog(win,{title:'Parent folder for recovered manuscript',properties:['openDirectory','createDirectory']});if(target.canceled)return 'Recovery import canceled.';
  const destination=await fs.realpath(target.filePaths[0]);if(store){const relative=path.relative(await fs.realpath(store.root),destination);if(!relative || (!relative.startsWith('..'+path.sep) && relative!=='..' && !path.isAbsolute(relative)))throw Error('Choose a recovery destination outside the open project.');}
  return 'Manuscript recovered to '+await restoreRecovery(input.filePaths[0],destination)+'. External assets must be restored separately.';
});
handle('rebuild',async ()=> { if(!store) throw Error('Open a project first.');const confirmation=await dialog.showMessageBox(win,{type:'question',title:'Rebuild Project Index',message:'Rebuild Project Index',detail:"Recreates PageHearth’s local project/search index from the project’s existing human-readable files. This does not delete or rewrite manuscript content.",buttons:['Cancel','Rebuild Index'],defaultId:0,cancelId:0,noLink:true});if(confirmation.response!==1)return 'Index rebuild canceled.'; await store.rebuildIndex(); return 'Project index rebuilt from manuscript files.'; });
handle('recovery-copy',async (p: Project)=> { validate(p); const r = await dialog.showSaveDialog(win,{title:'Save a recovery copy of all open manuscript content',defaultPath:'PageHearth-recovery.json',filters:[{name:'Readable recovery data',extensions:['json']}]}); if(r.canceled || !r.filePath) return 'Recovery copy canceled.'; await fs.writeFile(r.filePath,JSON.stringify(p,null,2),{flag:'wx'}); return 'Recovery copy saved.'; });
handle('resolve-stale',async(p:Project)=>{const project=await saveRecoveryAndRefresh(win,p);if(project)broadcastProject(project,win.webContents);return project;});
// Detached flush uses detached-save on the canonical queue. Waiting for it from
// inside that queue deadlocks shutdown. Flush first, then serialize storage close.
let closingSession:Promise<boolean>|null=null;
function closeSession(quit:boolean){
 exportService?.cancel();lastEbook=undefined;exportedFiles.clear();
 ebookJobs?.cancel();
 printJobs?.cancel();
 if(closingSession)return closingSession;
 const expected=store;
 closingSession=(async()=>{await closeDetachedWindows();return enqueue(async()=>{if(store!==expected)throw Error('Project changed while closing. Retry close.');pendingMedia.clear();coverPending.clear();coverController?.abort();coverResult=undefined;coverInterior=undefined;if(store){if(!await closeStore(store))return false;store=undefined;stopBackups();}await retirePublications(quit);if(quit){await windowStates.flush();exiting=true;win.close();}else menus();return true;});})().finally(()=>{closingSession=null;});
 return closingSession;
}
handle('close-project',()=>closeSession(false),true);
handle('close-warning',async(message:string)=>{const result=await dialog.showMessageBox(win,{type:'warning',title:'PageHearth could not close safely',message:'Your edits could not be saved. PageHearth remains open.',detail:String(message)+'\nKeep writing to inspect the error or save a recovery copy. Closing is never forced.',buttons:['Keep writing','Retry save and close'],defaultId:0,cancelId:0,noLink:true});return result.response===1;},true);
handle('quit',()=>closeSession(true),true);
app.setAppUserModelId('com.pagehearth.desktop');
if(ownsInstance)app.whenReady().then(async()=> {
  app.setAccessibilitySupportEnabled(true);
  settings = new SettingsStore(path.join(app.getPath('userData'),'settings.json'));await settings.load();
  externalAccess=new ExternalAccess(path.join(app.getPath('userData'),'external-access.json'));await externalAccess.load();
  await ensurePublicationSession().catch(()=>console.warn('Publication temporary storage unavailable; writing remains available.'));
  let sweeping=false;
  temporarySweep=setInterval(()=>{if(sweeping)return;sweeping=true;void PublicationTemporary.start(app.getPath('temp'),message=>console.warn(message)).then(session=>session.dispose()).catch(()=>console.warn('Publication temporary cleanup will retry.')).finally(()=>{sweeping=false;});},10*60*1000);
  temporarySweep.unref();
  detachedTheme.set((settings.value.themes??defaultThemes()).selected,[]);
  themeSettings=new ThemeSettings(settings,{
   read:async()=>{const r=await dialog.showOpenDialog(win,{title:'Import PageHearth Theme',properties:['openFile'],filters:[{name:'PageHearth theme',extensions:['pagehearth-theme']}]});if(r.canceled||!r.filePaths[0])return null;const file=r.filePaths[0],stat=await fs.stat(file);if(!stat.isFile()||stat.size>65536)throw Error('Theme file is too large or is not a regular file.');return fs.readFile(file,'utf8');},
   write:async(name,text)=>{const safe=name.replace(/[^A-Za-z0-9 _-]/g,'').slice(0,60)||'PageHearth Theme';const r=await dialog.showSaveDialog(win,{title:'Export Theme — choose a new filename',defaultPath:safe+'.pagehearth-theme',filters:[{name:'PageHearth theme',extensions:['pagehearth-theme']}]});if(!r.canceled&&r.filePath)await fs.writeFile(r.filePath,text,{flag:'wx'});},
   confirmDelete:async name=>(await dialog.showMessageBox(win,{type:'warning',title:'Delete custom theme',message:'Delete '+name+'?',detail:'This removes the custom theme from this computer. Export it first if you want to keep a copy. An active deleted theme returns to System.',buttons:['Cancel','Delete theme'],defaultId:0,cancelId:0,noLink:true})).response===1,
  },broadcastTheme);
  nativeTheme.on('updated',broadcastTheme);
  windowStates=new WindowStates(settings);
  const templateServices=new ProjectTemplateServices(app.getPath('home'),settings,file=>shell.trashItem(file));
  importWorkflow=new ImportWorkflow(templateServices,{
    version:app.getVersion(),
    choose:async defaultPath=>{const r=await dialog.showOpenDialog(win,{title:'Import Existing Manuscript',defaultPath,properties:['openFile'],filters:[{name:'Manuscript — PDF is Best Effort',extensions:['docx','txt','md','markdown','html','htm','epub','pdf']}]});return r.canceled?null:r.filePaths[0];},
    directory:async defaultPath=>{const r=await dialog.showOpenDialog(win,{title:'Parent folder for imported project',defaultPath,properties:['openDirectory','createDirectory']});return r.canceled?null:r.filePaths[0];},
    report:async()=>{if(!store)throw Error('Open an imported project first.');const file=path.join(store.root,'imports/import-report.json'),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8*1024*1024)throw Error('Import Report is unavailable.');return JSON.parse(await fs.readFile(file,'utf8'));},
    create:async run=>{if(store)throw Error('Close the current project before importing.');let adopted:Store|undefined;const made=await run({adopt:async(next,p)=>{adopted=next;next.externalAccess=externalAccess;store=next;revisions.reset(p);await next.writing.start();scheduleBackups();},rollbackAdoption:async()=>{if(store===adopted){stopBackups();store=undefined;menus();}},remember:(p,root)=>templateServices.rememberCreation(p,root)});menus();return {project:made.project,activeDocumentId:made.activeDocumentId};}
  });
  templateWorkflow=new TemplateWorkflow(templateServices,settings,{
    project:()=>store?.project||null,
    directory:async defaultPath=>{const r=await dialog.showOpenDialog(win,{title:'Choose project parent location',defaultPath,properties:['openDirectory','createDirectory']});return r.canceled?null:r.filePaths[0];},
    importFile:async defaultPath=>{const r=await dialog.showOpenDialog(win,{title:'Import Project Template',defaultPath,properties:['openFile'],filters:[{name:'PageHearth template',extensions:['pagehearth-template']}]});return r.canceled?null:r.filePaths[0];},
    exportFile:async defaultPath=>{const r=await dialog.showSaveDialog(win,{title:'Export Project Template — choose a new filename',defaultPath,filters:[{name:'PageHearth template',extensions:['pagehearth-template']}]});return r.canceled?null:r.filePath||null;},
    openFolder:async folder=>{const error=await shell.openPath(folder);if(error)throw Error(error);},
    create:async(template,name,parent)=>{
      if(store)throw Error('Close the current project before creating another.');let adopted:Store|undefined;
      const made=await templateServices.create(template,name,parent,{adopt:async(next,p)=>{adopted=next;next.externalAccess=externalAccess;store=next;revisions.reset(p);await next.writing.start();scheduleBackups();},rollbackAdoption:async()=>{if(store===adopted){stopBackups();store=undefined;menus();}}});
      menus();return {project:made.project,activeDocumentId:made.activeDocumentId};
    }
  });
  // Windows shell APIs cannot resolve virtual paths inside app.asar.
  const icon = app.isPackaged ? path.join(process.resourcesPath,'branding/PageHearth_App_Icon.ico') : path.join(app.getAppPath(),'assets/branding/pagehearth/PageHearth_App_Icon.ico');
  const savedPlacement=settings.value.windowStates?.main,placement=windowPlacement(savedPlacement,'main',workAreas());
  win = new BrowserWindow({...placement,show:false,backgroundColor:resolveTheme(settings.value.themes??defaultThemes(),nativeTheme.shouldUseDarkColors).tokens.appBackground,title:'PageHearth',icon,webPreferences:{preload:path.join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,plugins:true,spellcheck:false}});
  applyWindowChrome(win,resolveTheme(settings.value.themes??defaultThemes(),nativeTheme.shouldUseDarkColors),process.platform);
  windowStates.bind(win,'main',placement,savedPlacement);
  win.once('ready-to-show',()=>{if(savedPlacement?.maximized)win.maximize();if(savedPlacement?.fullscreen)win.setFullScreen(true);win.show();});
  if(process.platform==='win32' && app.isPackaged)win.setAppDetails({appId:'com.pagehearth.desktop',appIconPath:icon,appIconIndex:0,relaunchCommand:`"${process.execPath}"`,relaunchDisplayName:app.getName()});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.webContents.on('render-process-gone',()=>{
    rendererReady=false;fileOpening=false;shortcutCapture=false;win.webContents.setIgnoreMenuShortcuts(false);stopBackups();
    void enqueue(async()=>{
      const root=store?.root;
      if(store){await store.release();store=undefined;}
      const answer=await dialog.showMessageBox(win,{type:'warning',title:'Writing window interrupted',message:'The writing window stopped unexpectedly.',detail:'Saved files and protected editor changes are retained. Reload to inspect recovery. Keystrokes that had not reached the main process cannot be guaranteed.',buttons:['Reload','Exit'],defaultId:0,cancelId:1,noLink:true});
      if(answer.response===0){if(root)pendingFiles.unshift(path.join(root,'project.pagehearth'));win.webContents.reload();}
      else{exiting=true;win.close();}
    }).catch(e=>dialog.showErrorBox('Recovery needs attention',String(e)));
  });
  installContextMenu(win);
  win.on('close',event=>{ if(!exiting) { event.preventDefault(); command({kind:'quit'}); } });
  win.webContents.on('before-input-event',(event,input)=>{if(shortcutCapture)return;const action=zoomShortcut(input);if(action){event.preventDefault();requestZoom(action);return;}const id=commandForInput(input,settings.value.keybindings);if(id==='command-palette'){event.preventDefault();command({kind:'command-palette'});return;}if(id==='focus-mode'||id==='search-project'||id==='quicknotes'||id==='notebook'||id==='save'){event.preventDefault();if(store)command({kind:id});}});
  win.webContents.on('did-finish-load',()=>{win.webContents.setZoomFactor(settings.value.zoomPercent/100);win.webContents.send('zoom-changed',settings.value.zoomPercent);});
  const capability=updateCapabilities(process.platform,app.isPackaged);
  const adapter=createUpdateAdapter(app.getVersion(),url=>shell.openExternal(url));
  updates=new UpdateService(adapter,app.getVersion(),capability,{read:()=>settings.value.updates??{automatic:true},write:async patch=>{await settings.update({updates:{...(settings.value.updates??{automatic:true}),...patch}});}},state=>{for(const w of BrowserWindow.getAllWindows())if(!w.isDestroyed())w.webContents.send('update-state',state);});
  win.webContents.once('did-finish-load',()=>{const timer=setTimeout(()=>void updates.check(false),10000);timer.unref();});
  menus();
  win.loadFile(path.join(here,'../../dist/index.html'));
  win.on('closed',stopBackups);
});
app.on('window-all-closed',()=>app.quit());

ipcMain.handle('comment-command',async(event,id:string,action:string)=>{const entry=detachedEntry(event.sender);if(!entry||entry[1].surface!=='inspector'||event.senderFrame!==entry[1].window.webContents.mainFrame||!store?.project.author.comments?.byId[id]||!['navigate','selection','caret'].includes(action))throw Error('Invalid Inspector comment request.');command({kind:'comment',id,action:action as 'navigate'|'selection'|'caret'});win?.show();win?.focus();});
// Cover operations use the same trusted main-window boundary, save coordinator and atomic export writer.
handle('cover-choose',async(kind:string)=>{
 const target=store;if(!target)throw Error('Open a project first.');let bytes:Buffer;
 if(kind==='clipboard'){const b=await firstClipboardPng(await clipboard.read(),raw=>{const image=nativeImage.createFromBuffer(raw);return image.isEmpty()?Buffer.alloc(0):image.toPNG();});if(!b?.length)return null;bytes=b;}
 else{if(!['image','pdf'].includes(kind))throw Error('Invalid cover import.');const selected=await dialog.showOpenDialog(win,{title:kind==='pdf'?'Choose Existing Full-Wrap Cover PDF':'Choose Cover Image',properties:['openFile'],filters:[{name:kind==='pdf'?'PDF':'Images',extensions:kind==='pdf'?['pdf']:['png','jpg','jpeg']}]});if(selected.canceled)return null;const file=selected.filePaths[0];if((await fs.stat(file)).size>50*1024*1024)throw Error('Choose a file smaller than 50 MiB.');bytes=await fs.readFile(file);}
 const inspected=await inspectCoverCandidate(bytes,kind);if('error' in inspected)return inspected;const {info}=inspected;if(store!==target)throw Error('Project changed while choosing artwork.');if(coverPending.size>=4)throw Error('Finish or cancel the current image selection first.');const token=randomUUID();coverPending.set(token,{projectId:target.project.manifest.id,bytes,extension:info.format==='PDF'?'.pdf':info.format==='PNG'?'.png':'.jpg'});return {token,info};
},true);
handle('cover-discard',async(token:string)=>{coverPending.delete(token);},true);
handle('cover-attach',async(p:Project,token:string,slot:string)=>{
 validate(p);const target=store,item=coverPending.get(token);if(!target||!item||item.projectId!==p.manifest.id||target.project.manifest.id!==p.manifest.id||!['front','back','ebook','wrap'].includes(slot))throw Error('Cover selection expired.');if((slot==='wrap')!==(item.extension==='.pdf'))throw Error('Wrong artwork type.');
 const asset=await writeCoverAsset(target.root,item.bytes,item.extension),next=editPublication(p,plan=>{const c=structuredClone(readCovers(plan));if(slot==='front'||slot==='back')c[slot].asset=asset;else if(slot==='ebook')c.ebookAsset=asset;else c.wrapAsset=asset;plan.covers=c;});

 // Once persistence starts, retain bytes on ambiguous failure: recovery evidence may reference them.
 const result=await saveProject(next);coverPending.delete(token);broadcastProject(result.project);return result;
});
handle('cover-inspect',async(projectId:string,asset:string)=>{const target=store;if(!target||target.project.manifest.id!==projectId)throw Error('Project changed.');const file=await verifiedAsset(target.root,asset);if((await fs.stat(file)).size>50*1024*1024)throw Error('Cover exceeds 50 MiB.');return inspectCoverInWorker(await fs.readFile(file),asset);},true);
handle('cover-interior',async(p:Project)=>{validate(p);return store?.project.manifest.id===p.manifest.id&&coverInterior?.projectId===p.manifest.id&&coverInterior.fingerprint===printFingerprint(p)?{pages:coverInterior.pages,fingerprint:coverInterior.fingerprint}:null;},true);
handle('cover-cancel',async()=>{coverController?.abort();coverResult=undefined;},true);
handle('cover-render',async(p:Project)=>{
 validate(p);const target=store,interior=coverInterior;if(!target||target.project.manifest.id!==p.manifest.id||!interior||interior.projectId!==p.manifest.id||interior.fingerprint!==printFingerprint(p))throw Error('Print interior changed. Refresh Final Print Preview to recalculate cover dimensions.');if(interior.diagnostics.some(i=>i.blocking))throw Error('Resolve Final Print Preview blocking issues first.');
 coverController?.abort();const controller=new AbortController();coverController=controller;coverResult=undefined;const result=await coverWorker({root:target.root,plan:readPublication(p),pages:interior.pages,interior:interior.fingerprint,resources:app.isPackaged?path.join(process.resourcesPath,'typst'):path.join(app.getAppPath(),'assets/typst'),temporary:path.join(temporarySession!.root,'covers')},controller.signal);if(store!==target||controller.signal.aborted)throw Error('Cover canceled or project changed.');coverResult=result;return result;
},true);
handle('cover-save',async(p:Project,id:string)=>{
 validate(p);const target=store,result=coverResult,controller=coverController;if(exportSaving||!target||!result||!controller||result.id!==id)throw Error('Refresh Cover Preview before export.');
 const current=()=>store===target&&coverResult===result&&!controller.signal.aborted&&result.interior===printFingerprint(target.project)&&result.fingerprint===coverHash(coverIdentity(readPublication(target.project),result.interior));
 if(result.blocking.length)throw Error(result.blocking.join(' '));if(!current()||result.fingerprint!==coverHash(coverIdentity(readPublication(p),result.interior)))throw Error('Wait for Saved and refresh Cover Preview.');
 exportSaving=true;try{const r=await dialog.showSaveDialog(win,{title:'Export Print Cover PDF',defaultPath:exportFilename(readPublication(p).metadata.title).replace(/\.pdf$/,' - Cover.pdf'),filters:[{name:'Cover PDF',extensions:['pdf']}],properties:['showOverwriteConfirmation']});if(r.canceled||!r.filePath)return null;const file=await safeExportDestination(r.filePath,target.root,'pdf'),existing=await destinationSnapshot(file);if(existing!==null){const a=await dialog.showMessageBox(win,{type:'warning',message:'Replace '+path.basename(file)+'?',buttons:['Cancel','Replace'],defaultId:0,cancelId:0});if(a.response!==1)return null;}if(store===target&&!win.isDestroyed())win.webContents.send('export-progress',{projectId:p.manifest.id,requestId:id,format:'pdf',stage:'write',destination:file});const saved=await saveExport(result.pdf,{},file,target.root,'pdf',existing,controller.signal,current);exportedFiles.add(saved);return saved;}finally{exportSaving=false;}
},true);

// Import leases are rollback-able only before a manuscript transaction/protection attempt.
const retainedManuscriptImages=new Set<string>(),unpublishedManuscriptImages=new Set<string>();
const manuscriptImageLeases=new Map<string,{root:string;asset:string;created:boolean;sourceAsset?:string;sourceCreated?:boolean}>();
handle('manuscript-image-import',async(projectId:string,kind:string,source?:string)=>{
 const target=store;if(!target||target.project.manifest.id!==projectId||!['file','clipboard'].includes(kind))throw Error('Open the intended project before inserting an image.');
 if(manuscriptImageLeases.size>=4)throw Error('Finish the current image insertion first.');
 let bytes:Buffer;
 if(kind==='clipboard'){try{const value=await manuscriptClipboard(await clipboard.read(),raw=>{manuscriptImageDecodeBounds(raw);const image=nativeImage.createFromBuffer(raw);return image.isEmpty()?Buffer.alloc(0):image.toPNG();});if(!value?.length)throw Error('No image found on the clipboard.');bytes=value;}catch(e){throw Error(e instanceof Error?e.message:'The clipboard image could not be read. Copy it again.');}}
 else{if(source!==undefined&&(typeof source!=='string'||!path.isAbsolute(source)||! /\.(png|jpe?g)$/i.test(source)))throw Error('Drop a PNG or JPEG image.');const choice=source?{canceled:false,filePaths:[source]}:await dialog.showOpenDialog(win,{title:'Insert Image',properties:['openFile'],filters:[{name:'PNG or JPEG image',extensions:['png','jpg','jpeg']}]});if(choice.canceled)return null;if((await fs.stat(choice.filePaths[0])).size>50*1024*1024)throw Error('Choose an image smaller than 50 MiB.');bytes=await fs.readFile(choice.filePaths[0]);}
 return enqueue(async()=>{if(store!==target)throw Error('Project changed. Insert the image again.');
 const checked=manuscriptImageDecodeBounds(bytes),decoded=nativeImage.createFromBuffer(bytes);if(decoded.isEmpty()||decoded.getSize().width!==checked.width||decoded.getSize().height!==checked.height)throw Error('Image could not be decoded safely. Export a valid PNG or JPEG and insert it again.');const orientation=jpegOrientation(bytes),bitmap=orientation!==1?decoded.toBitmap():undefined;
 const result=await importManuscriptImage(target.root,bytes,bitmap,orientation),token=randomUUID();if(result.created)unpublishedManuscriptImages.add(target.root+'|'+result.asset);if(result.sourceAsset&&result.sourceCreated)unpublishedManuscriptImages.add(target.root+'|'+result.sourceAsset);manuscriptImageLeases.set(token,{root:target.root,asset:result.asset,created:result.created,sourceAsset:result.sourceAsset,sourceCreated:result.sourceCreated});return {token,sourceAsset:result.sourceAsset,asset:result.asset,width:result.width,height:result.height};});
},true);
handle('manuscript-image-finish',async(token:string,keep:boolean)=>{
 if(typeof keep!=='boolean')throw Error('Invalid image completion.');const lease=manuscriptImageLeases.get(token);if(!lease)return;manuscriptImageLeases.delete(token);
 for(const [asset,created] of [[lease.asset,lease.created],[lease.sourceAsset,lease.sourceCreated]] as const){if(!asset)continue;const key=lease.root+'|'+asset;if(keep){retainedManuscriptImages.add(key);unpublishedManuscriptImages.delete(key);continue;}if(!unpublishedManuscriptImages.has(key)||retainedManuscriptImages.has(key)||[...manuscriptImageLeases.values()].some(v=>v.root===lease.root&&(v.asset===asset||v.sourceAsset===asset)))continue;if(store?.root===lease.root&&JSON.stringify(store.project).includes(JSON.stringify(asset)))continue;await discardUnpublishedManuscriptImage(lease.root,asset);unpublishedManuscriptImages.delete(key);}
});
const manuscriptThumbnails=new Map<string,string>();
handle('manuscript-image-read',async(projectId:string,asset:string)=>{
 const target=store;if(!target||target.project.manifest.id!==projectId||!manuscriptImageAsset(asset))throw Error('Image unavailable.');const file=await verifiedAsset(target.root,asset),stat=await fs.stat(file);if(stat.size>50*1024*1024)throw Error('Image too large.');const key=target.root+'|'+asset+'|'+stat.mtimeMs+'|'+stat.size,cached=manuscriptThumbnails.get(key);if(cached)return cached;
 const bytes=await fs.readFile(file);if(store!==target)throw Error('Project changed.');manuscriptImageDecodeBounds(bytes);const image=nativeImage.createFromBuffer(bytes);if(image.isEmpty())throw Error('Image unavailable.');const size=image.getSize(),ratio=Math.min(1,1200/size.width,1200/size.height),thumbnail=ratio<1?image.resize({width:Math.max(1,Math.round(size.width*ratio)),height:Math.max(1,Math.round(size.height*ratio)),quality:'good'}):image,src=thumbnail.toDataURL();if(manuscriptThumbnails.size>=24)manuscriptThumbnails.delete(manuscriptThumbnails.keys().next().value!);manuscriptThumbnails.set(key,src);return src;
},true);
