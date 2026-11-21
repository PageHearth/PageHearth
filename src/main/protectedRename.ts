import {promises as fs} from 'node:fs';
export const protectedRenameDelays=[10,20,40,80] as const;
/** Retry only replacement contention, never writes, sync, validation or canonical commits. */
export async function renameProtected(temp:string,file:string,rename=fs.rename,pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms)),platform=process.platform){
  for(let attempt=0;;attempt++){
    try{await rename(temp,file);return;}catch(error){
      const code=(error as NodeJS.ErrnoException).code;
      if(attempt===protectedRenameDelays.length||!(code==='EBUSY'||platform==='win32'&&(code==='EPERM'||code==='EACCES')))throw error;
      await pause(protectedRenameDelays[attempt]);
    }
  }
}
