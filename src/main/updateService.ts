import {updateDue,updateError,type UpdateState,type UpdateRelease,type UpdateCapabilities} from '../shared/updates.js';
export interface UpdateAdapter{check():Promise<UpdateRelease|null>;open(release:UpdateRelease,destination:'download'|'github'):Promise<void>;}
// Deliberately has no project, shutdown, installer or binary-download dependency.
export class UpdateService{
 private state:UpdateState;private busy=false;private opening=false;
 constructor(private adapter:UpdateAdapter,version:string,capabilities:UpdateCapabilities,private preferences:{read:()=>{automatic:boolean;lastCheck?:number};write:(patch:{automatic?:boolean;lastCheck?:number})=>Promise<void>},private changed:(state:UpdateState)=>void,private log:(event:string)=>void=()=>{}){const p=preferences.read();this.state={phase:'idle',currentVersion:version,...p,capabilities};}
 getState(){return structuredClone(this.state);}
 private set(patch:Partial<UpdateState>){this.state={...this.state,...patch};this.log(this.state.phase);this.changed(this.getState());}
 async automatic(enabled:boolean){await this.preferences.write({automatic:enabled});this.set({automatic:enabled});}
 async check(manual=true){if(this.busy)return;if(!this.state.capabilities.supportsUpdateCheck){this.set({phase:'error',message:'Update checks are available in packaged PageHearth.'});return;}const p=this.preferences.read();if(!manual&&!updateDue(p.automatic,p.lastCheck,Date.now()))return;this.busy=true;this.set({phase:'checking',message:undefined,release:undefined});try{const now=Date.now();await this.preferences.write({lastCheck:now});this.set({lastCheck:now});const release=await this.adapter.check();this.set({phase:release?'updateAvailable':'upToDate',release:release??undefined});}catch(e){this.set(updateError(e));}finally{this.busy=false;}}
 async open(destination:'download'|'github'){if(this.busy||this.opening||!this.state.release||!this.state.capabilities.supportsExternalDownload)return;this.opening=true;try{await this.adapter.open(this.state.release,destination);this.set({message:undefined});}catch{this.set({message:'Could not open your browser. Please try again.'});}finally{this.opening=false;}}
}
