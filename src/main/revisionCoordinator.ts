import {type Project} from '../shared/model.js';
import {reconcileProject} from '../shared/reconcile.js';

export type CoordinatedSave={project:Project;reconciled:boolean};

/** Keeps only same-session bases needed to reconcile live renderer snapshots. */
export class RevisionCoordinator{
  private history=new Map<number,Project>();
  constructor(private readonly limit=64){}
  reset(project:Project){this.history.clear();this.remember(project);}
  remember(project:Project){
    this.history.set(project.manifest.revision,structuredClone(project));
    while(this.history.size>this.limit)this.history.delete(this.history.keys().next().value!);
  }
  async save(candidate:Project,canonical:Project,persist:(project:Project,base:number)=>Promise<Project>):Promise<CoordinatedSave>{
    if(candidate.manifest.id!==canonical.manifest.id)throw Error('Project identity changed.');
    const incoming=structuredClone(candidate),revision=incoming.manifest.revision;
    if(revision>canonical.manifest.revision)throw Error('This save has an unknown future revision. Your edits remain open.');
    let next=incoming,reconciled=false;
    if(revision<canonical.manifest.revision){
      const base=this.history.get(revision);
      if(!base)throw Error('This save is too old to reconcile safely. Your edits remain protected; save a recovery copy before refreshing.');
      const result=reconcileProject(base,incoming,canonical);
      if(!result.project)throw Error(`This save conflicts with newer project data at ${result.conflicts.slice(0,3).join(', ')}. Your edits remain protected; save a recovery copy before refreshing.`);
      next=result.project;reconciled=true;
    }
    const saved=await persist(next,canonical.manifest.revision);
    this.remember(saved);
    return {project:saved,reconciled};
  }
}
