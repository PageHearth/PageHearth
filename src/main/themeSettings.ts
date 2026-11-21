import {randomUUID} from 'node:crypto';
import type {SettingsStore} from './settings.js';
import {builtinThemes,defaultThemes,resolveTheme,readTheme,importTheme,exportTheme,uniqueThemeName,type ThemeRequest,type ThemePreferences} from '../shared/themes.js';
export type ThemeFiles={read:()=>Promise<string|null>;write:(name:string,text:string)=>Promise<void>;confirmDelete:(name:string)=>Promise<boolean>};
/** Uses the existing SettingsStore transaction queue, never project storage. */
export class ThemeSettings{
 constructor(private settings:SettingsStore,private files:ThemeFiles,private changed:()=>void){}
 get value(){return this.settings.value.themes??defaultThemes();}
 async request(request:ThemeRequest):Promise<ThemePreferences>{
  if(!request||typeof request!=='object')throw Error('Invalid appearance request.');
  const r=request;
  if(r.action==='list')return this.value;
  if(r.action==='export'){const t=this.value.custom.find(t=>t.id===r.id);if(!t)throw Error('Choose a custom theme to export.');await this.files.write(t.name,exportTheme(t));return this.value;}
  if(r.action==='import'){const text=await this.files.read();if(text===null)return this.value;const id='custom-'+randomUUID();await this.settings.update(s=>{const p=s.themes??defaultThemes(),t=importTheme(text,p,id);if(p.custom.length>=100)throw Error('At most 100 custom themes can be stored.');return {themes:{selected:t.id,custom:[...p.custom,t]}};});}
  else if(r.action==='delete'){const t=this.value.custom.find(t=>t.id===r.id);if(!t)throw Error('Built-in themes cannot be deleted.');if(!await this.files.confirmDelete(t.name))return this.value;await this.settings.update(s=>{const p=s.themes??defaultThemes();if(JSON.stringify(p.custom.find(v=>v.id===t.id))!==JSON.stringify(t))throw Error('This theme changed. Review it before deleting.');return {themes:{selected:p.selected===t.id?'System':p.selected,custom:p.custom.filter(v=>v.id!==t.id)}};});}
  else await this.settings.update(s=>{
   const p=s.themes??defaultThemes();
   if(r.action==='select'||r.action==='migrate'){
    if(r.action==='migrate'&&s.themes)return {};
    if(!['System',...builtinThemes.map(t=>t.id),...p.custom.map(t=>t.id)].includes(r.id))throw Error('Unknown theme.');return {themes:{...p,selected:r.id}};
   }
   if(r.action==='duplicate'){
    if(p.custom.length>=100)throw Error('At most 100 custom themes can be stored.');if(![...builtinThemes.map(t=>t.id),...p.custom.map(t=>t.id)].includes(r.id))throw Error('Choose a preset or custom theme to duplicate.');
    const base=resolveTheme({...p,selected:r.id}),t={...structuredClone(base),id:'custom-'+randomUUID(),name:uniqueThemeName(base.name+' copy',p.custom)};return {themes:{selected:t.id,custom:[...p.custom,t]}};
   }
   if(r.action==='save'){
    const t=readTheme(r.theme),old=p.custom.find(v=>v.id===t.id);if(!old)throw Error('Built-in themes cannot be edited. Duplicate a theme first.');if(JSON.stringify(old)!==JSON.stringify(r.expected))throw Error('This theme changed. Close and reopen the editor before saving.');if([...builtinThemes,...p.custom.filter(v=>v.id!==t.id)].some(v=>v.name.toLowerCase()===t.name.toLowerCase()))throw Error('A theme with that name already exists.');return {themes:{...p,custom:p.custom.map(v=>v.id===t.id?t:v)}};
   }
   throw Error('Unknown appearance action.');
  });
  this.changed();return this.value;
 }
}
