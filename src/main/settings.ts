import {loadThemes} from '../shared/themes.js';
import {normalizeFontFamilies,recentFontFamilies} from '../shared/fonts.js';
import {validWindowState} from './windowState.js';
import {validateBindings,cleanRecent} from '../shared/commands.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppSettings, RecentProject } from '../shared/preferences.js';
import {userContentPaths,ensureContentDirectory} from './userContent.js';

const defaults = (): AppSettings => ({ version: 1, zoomPercent: 100, recentProjects: [] });
export class SettingsStore {
  value = defaults();
  warning: string | undefined;
  private writes:Promise<unknown>=Promise.resolve();
  constructor(readonly file: string) {}
  async load() {
    try {
      const raw = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (raw.version !== 1) throw Error('Unsupported settings version');
      const appearance=loadThemes(raw.themes);
      if(appearance.warning){this.warning=appearance.warning;await fs.copyFile(this.file,this.file+`.appearance-unreadable-${randomUUID()}`);}
      this.value = {
        ...defaults(),
        updates:raw.updates===undefined?undefined:{automatic:raw.updates?.automatic!==false,lastCheck:Number.isFinite(raw.updates?.lastCheck)&&raw.updates.lastCheck>0?raw.updates.lastCheck:undefined},
        themes:raw.themes===undefined?undefined:appearance.preferences,
        keybindings:validateBindings(raw.keybindings),
        recentCommands:raw.recentCommands===undefined?undefined:cleanRecent(raw.recentCommands),
        recentFonts:raw.recentFonts===undefined?undefined:recentFontFamilies(raw.recentFonts),
        favoriteFonts:raw.favoriteFonts===undefined?undefined:normalizeFontFamilies(raw.favoriteFonts),
        zoomPercent: Number.isInteger(raw.zoomPercent) && raw.zoomPercent >= 50 && raw.zoomPercent <= 200 ? raw.zoomPercent : 100,
        lastRestoreDirectory:typeof raw.lastRestoreDirectory==='string'&&path.isAbsolute(raw.lastRestoreDirectory)?raw.lastRestoreDirectory:undefined,
        lastExportDirectory:typeof raw.lastExportDirectory==='string'&&path.isAbsolute(raw.lastExportDirectory)?raw.lastExportDirectory:undefined,
 exportPreferences:raw.exportPreferences&&['pdf','epub','docx','html','md','txt'].includes(raw.exportPreferences.format)?{format:raw.exportPreferences.format,...Object.fromEntries(['front','back','titlePage'].filter(k=>typeof raw.exportPreferences[k]==='boolean').map(k=>[k,raw.exportPreferences[k]]))}:undefined,
 lastCreateDirectory: typeof raw.lastCreateDirectory === 'string' ? raw.lastCreateDirectory : undefined,
        lastOpenDirectory: typeof raw.lastOpenDirectory === 'string' ? raw.lastOpenDirectory : undefined,
        lastTemplateExportDirectory: typeof raw.lastTemplateExportDirectory==='string'&&path.isAbsolute(raw.lastTemplateExportDirectory)?raw.lastTemplateExportDirectory:undefined,
        lastTemplateImportDirectory: typeof raw.lastTemplateImportDirectory==='string'&&path.isAbsolute(raw.lastTemplateImportDirectory)?raw.lastTemplateImportDirectory:undefined,
        lastManuscriptImportDirectory: typeof raw.lastManuscriptImportDirectory==='string'&&path.isAbsolute(raw.lastManuscriptImportDirectory)?raw.lastManuscriptImportDirectory:undefined,
        lastTemplateCreator:typeof raw.lastTemplateCreator==='string'&&raw.lastTemplateCreator.length<=200?raw.lastTemplateCreator:undefined,
        recentProjects: Array.isArray(raw.recentProjects) ? raw.recentProjects.filter((r: any) => typeof r?.title === 'string' && typeof r.path === 'string' && path.isAbsolute(r.path) && typeof r.lastOpened === 'string' && Number.isFinite(Date.parse(r.lastOpened))).slice(0, 20) : [],
        windowStates:raw.windowStates&&typeof raw.windowStates==='object'?Object.fromEntries(Object.entries(raw.windowStates).filter((entry):entry is [string,import('../shared/preferences.js').WindowState]=>validWindowState(entry[1])).slice(-100)):undefined,
        researchKeepOnTop:raw.researchKeepOnTop&&typeof raw.researchKeepOnTop==='object'?Object.fromEntries(Object.entries(raw.researchKeepOnTop).filter((entry):entry is [string,boolean]=>typeof entry[0]==='string'&&typeof entry[1]==='boolean')):undefined,
      };
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        // Preserve invalid settings before allowing later preference writes.
        try { await fs.copyFile(this.file, this.file + `.unreadable-${randomUUID()}`); }
        catch { this.warning = 'Local preferences could not be read. Defaults are in use; preference updates may fail.'; return; }
        this.warning = 'Local preferences could not be read. The original file was preserved and defaults are in use.';
      }
    }
  }
  update(patch: Partial<AppSettings>|((current:AppSettings)=>Partial<AppSettings>)) {
    const work=this.writes.then(()=>this.write(patch));this.writes=work.catch(()=>{});return work;
  }
  private async write(patch:Partial<AppSettings>|((current:AppSettings)=>Partial<AppSettings>)) {
    const next = { ...this.value, ...(typeof patch==='function'?patch(this.value):patch), version: 1 as const };
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const temp = this.file + `.${randomUUID()}.tmp`;
    const handle = await fs.open(temp, 'wx');
    try { await handle.writeFile(JSON.stringify(next, null, 2) + '\n'); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(temp, this.file);
    this.value = next;
    return this.value;
  }
  async recentFont(family:string){return this.update(current=>({recentFonts:recentFontFamilies([family,...(current.recentFonts||[])])}));}
  async favoriteFont(family:string,favorite:boolean){
    return this.update(current=>({favoriteFonts:normalizeFontFamilies(favorite?[...(current.favoriteFonts||[]),family]:(current.favoriteFonts||[]).filter(name=>name.toLocaleLowerCase('en-US')!==family.toLocaleLowerCase('en-US')))}));
  }
  async remember(project: RecentProject) {
    const key = path.resolve(project.path).toLowerCase();
    await this.update({ recentProjects: [project, ...this.value.recentProjects.filter(r => path.resolve(r.path).toLowerCase() !== key)].slice(0, 20) });
  }
  async remove(root: string) {
    return this.update({ recentProjects: this.value.recentProjects.filter(r => r.path !== root) });
  }
}

export async function directoryAvailable(folder: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fs.stat(folder).then(s => s.isDirectory(), () => false),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 1200); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
export async function browseDirectory(stored: string | undefined, documents: string, home: string) {
  for (const candidate of [stored, documents, home]) if (candidate && path.isAbsolute(candidate) && await directoryAvailable(candidate)) return candidate;
  return undefined; // Let Windows choose if even the profile directories are unavailable.
}

export async function projectBrowseDirectory(stored:string|undefined,documents:string,home:string){
  // Existing valid browse preferences always win; never relocate an existing project.
  if(stored&&path.isAbsolute(stored)&&await directoryAvailable(stored))return stored;
  const initial=userContentPaths(home).projects;
  try{await ensureContentDirectory(initial);return initial;}catch{return browseDirectory(undefined,documents,home);}
}
