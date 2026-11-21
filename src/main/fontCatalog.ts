import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {normalizeFontFamilies,fallbackFontFamilies,type FontCatalog} from '../shared/fonts.js';
const execute=promisify(execFile);
async function windowsFamilies():Promise<unknown>{
  const script="[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false); Add-Type -AssemblyName System.Drawing; $catalog = New-Object System.Drawing.Text.InstalledFontCollection; try { @($catalog.Families | ForEach-Object { $_.Name }) | ConvertTo-Json -Compress } finally { $catalog.Dispose() }";
  const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const {stdout}=await execute(executable,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:5000,maxBuffer:2*1024*1024,encoding:'utf8'});
  const result=JSON.parse(stdout.replace(/^\uFEFF/,''));return typeof result==='string'?[result]:result;
}
/** One local, bounded OS query per app session; renderer never receives paths/font bytes. */
export function createFontCatalog(discover:()=>Promise<unknown>=windowsFamilies,platform=process.platform){
  let cached:Promise<FontCatalog>|undefined;
  return ()=>cached??=(async()=>{try{if(platform!=='win32')throw Error('No platform provider');const families=normalizeFontFamilies(await discover());if(!families.length)throw Error('Empty catalog');return {families,source:'installed' as const};}catch{return {families:[...fallbackFontFamilies],source:'fallback' as const,warning:'Installed font listing unavailable. Common family names are shown; local availability varies.'};}})();
}
export const getFontCatalog=createFontCatalog();
