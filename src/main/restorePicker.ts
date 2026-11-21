import path from 'node:path';
import {promises as fs} from 'node:fs';
import {driveIdentity,ordinaryPath} from './externalAccess.js';
import {userContentPaths} from './userContent.js';
import type {SettingsStore} from './settings.js';
import type {OpenDialogOptions,OpenDialogReturnValue} from 'electron';

// Only local profile preferences and the main-process open-project root are
// inputs. Portable backup settings are deliberately not consulted.
export async function restoreDirectoryAvailable(folder:string,drive=driveIdentity,ordinary=ordinaryPath,stat=fs.stat){
 try{
  if(!path.isAbsolute(folder)||folder.includes('\0'))return false;
  if(process.platform==='win32'){
   if(!/^[a-z]:\\/i.test(folder)||folder.slice(2).includes(':'))return false;
   // Reject UNC, mapped drives and SUBST before any filesystem probe.
   if(!/^\\Device\\HarddiskVolume\d+$/i.test(await drive(folder)))return false;
  }
  await ordinary(folder); // Reject junctions/symlinks before following targets.
  return (await stat(folder)).isDirectory();
 }catch{return false;}
}
export async function restoreBrowseDirectory(remembered:string|undefined,projectRoot:string|undefined,home:string,available=restoreDirectoryAvailable){
 for(const candidate of [remembered,projectRoot?path.join(projectRoot,'backups'):undefined,userContentPaths(home).projects,home]){
  if(candidate&&await available(candidate))return candidate;
 }
 return undefined;
}
export async function chooseRestoreZip(settings:Pick<SettingsStore,'value'|'update'>,projectRoot:string|undefined,home:string,choose:(options:OpenDialogOptions)=>Promise<OpenDialogReturnValue>,available=restoreDirectoryAvailable){
 const defaultPath=await restoreBrowseDirectory(settings.value.lastRestoreDirectory,projectRoot,home,available);
 const result=await choose({title:'Select a PageHearth Backup ZIP',defaultPath,filters:[{name:'PageHearth Backup ZIP',extensions:['zip']}],properties:['openFile']});
 if(result.canceled||!result.filePaths[0])return null;
 const file=result.filePaths[0],directory=path.dirname(file);
 // A native selection is consent to read this archive, not an external backup
 // or Research grant. Remember only local, nonredirected directories.
 if(await available(directory))await settings.update({lastRestoreDirectory:directory}).catch(()=>{});
 return file;
}
