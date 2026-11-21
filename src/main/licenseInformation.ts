import path from 'node:path';
import {access} from 'node:fs/promises';

/** Only the fixed installed offline index may be opened; no renderer-supplied path. */
export async function openLicenseInformation(resources:string,openPath:(file:string)=>Promise<string>,developmentLegal?:string){
 const file=path.join(developmentLegal||path.join(resources,'documentation','legal'),'index.html');
 await access(file);
 const error=await openPath(file);
 if(error)throw Error(error);
}
