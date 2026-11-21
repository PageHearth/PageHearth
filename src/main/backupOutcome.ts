import {ExternalAccessRequired} from './externalAccess.js';
import type {Store} from './storage.js';
export async function closeWithBackupConsent(target:Pick<Store,'authorizedBackupDirectory'|'close'>,confirm:()=>Promise<boolean>){
 try{await target.authorizedBackupDirectory();}catch(error){
  if(!(error instanceof ExternalAccessRequired))throw error;
  if(!await confirm())return false;
  await target.close(true);return true;
 }
 await target.close();return true;
}
export type BackupOutcome={kind:'saved';file:string}|{kind:'permission-required'|'backup-failed';message:string};
/** Only known backup destination failures are nonfatal. Unknown/corruption errors propagate. */
export async function manualBackup(backup:()=>Promise<string>):Promise<BackupOutcome>{
 try{return {kind:'saved',file:await backup()};}
 catch(error){
  if(error instanceof ExternalAccessRequired)return {kind:'permission-required',message:'Backup needs permission. Your manuscript save is unaffected. Open Settings → Project protection → Choose backup folder to approve the destination on this computer.'};
  if(['EACCES','EPERM','ENOSPC','ENOENT','EIO','EBUSY','EROFS','ENOTDIR'].includes((error as NodeJS.ErrnoException)?.code||''))return {kind:'backup-failed',message:'Backup failed. Your manuscript save is unaffected. Check the backup destination and retry. '+String(error)};
  throw error;
 }
}
