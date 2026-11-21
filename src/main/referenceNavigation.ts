import type {Project} from '../shared/model.js';
/** Resolve only the stable World Bible ID. Research links are a separate model. */
export async function openReferenceTarget(project:Project|undefined,id:string,ports:{unavailable:(message:string)=>Promise<void>;bringDetached:(id:string)=>boolean;openEntity:(id:string)=>void}){
 const target=project?.author.worldBible?.entities.find(item=>item.id===id);
 if(!target||target.trashed){await ports.unavailable(target?'Reference target is in Trash.':'Reference target is missing.');return;}
 if(!ports.bringDetached(target.id))ports.openEntity(target.id);
}

/** Shared menu/IPC boundary: synchronous throws and rejected navigation are reported. */
export async function invokeReferenceOpen(id:unknown,ports:{valid:()=>boolean;open:(id:string)=>Promise<void>;report:(error:unknown)=>void}){
 try{if(typeof id!=='string'||!id.trim())throw Error('Invalid reference target descriptor.');if(!ports.valid())throw Error('Reference source window or project is no longer available.');await ports.open(id);}catch(error){ports.report(error);}
}
