import type {Project} from '../shared/model';
import {editPublication,type PublicationPlan} from '../shared/publication';
export type PublicationEdit=(projectId:string,change:(plan:PublicationPlan)=>void)=>Project;
/** Read the shell's acknowledged/local head at event time, not a rendered snapshot. */
export function publicationEdit(current:Project|null,projectId:string,change:(plan:PublicationPlan)=>void):Project{
 if(!current||current.manifest.id!==projectId)throw Error('Project changed before publication edit.');
 return editPublication(current,change);
}
