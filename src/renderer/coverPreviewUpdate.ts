import {coverGeometry} from '../shared/covers';
import {readPublication} from '../shared/publication';
import type {Project} from '../shared/model';
import type {Bridge} from '../shared/bridge';

/** Reuse the canonical print service/cache; no second pagination identity or estimate. */
export async function updateCoverPreview(project:Project,api:Pick<Bridge,'coverInterior'|'printRender'|'coverRender'>,request:string,active:()=>boolean,stage:(text:string)=>void){
 const check=()=>{if(!active())throw Error('Cover Preview update canceled.');};
 check();let interior=await api.coverInterior(project);check();
 if(!interior){stage('Rendering print interior…');const proof=await api.printRender(project,request);check();if(proof.diagnostics.some(i=>i.blocking))throw Error(proof.diagnostics.filter(i=>i.blocking).map(i=>i.message).join('\n'));interior={pages:proof.pages,fingerprint:proof.fingerprint};}
 stage('Calculating cover dimensions…');check();coverGeometry(readPublication(project),interior.pages);
 stage('Rendering cover preview…');const result=await api.coverRender(project);check();return {interior,result};
}
