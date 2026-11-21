import type {Project} from '../shared/model';
import {moveNote} from '../shared/author';
export const NOTE_DRAG='application/x-pagehearth-note';
export const noteProjectType=(project:Project)=>'application/x-pagehearth-notebook-project-'+project.manifest.id.toLowerCase();
export function noteDragPayload(project:Project,id:string){return JSON.stringify({projectId:project.manifest.id,noteId:id});}
export function compatibleNoteDrag(project:Project,types:readonly string[]){return types.includes(NOTE_DRAG)&&types.includes(noteProjectType(project));}
export function readNoteDrag(project:Project,raw:string):string|null{try{const value=JSON.parse(raw);return value.projectId===project.manifest.id&&typeof value.noteId==='string'&&project.author.notebook.notes.some(n=>n.id===value.noteId&&!n.trashed)?value.noteId:null;}catch{return null;}}
/** Shared by File in and folder drops. Invalid/stale and same-folder moves are no-ops. */
export function fileNotebookNote(project:Project,id:string,folder:string|null):Project{
 const note=project.author.notebook.notes.find(n=>n.id===id);
 if(!note||note.folder===folder||(folder!==null&&!project.author.notebook.folders.some(f=>f.id===folder&&!f.trashed)))return project;
 return moveNote(project,id,folder);
}
