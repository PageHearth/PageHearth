import type {Project} from '../shared/model.js';
import {captureQuickNotes,clearQuickNotes} from '../shared/author.js';

/** A failed clear acknowledgement must not hide the scratchpad in this window. */
export function restoreFailedQuickNotes(current:Project,original:Project){
  if(current.manifest.id!==original.manifest.id||current.author.quickNotes.text||!original.author.quickNotes.text)return current;
  return {...current,author:{...current.author,quickNotes:structuredClone(original.author.quickNotes)}};
}

/** The scratchpad is cleared only after the canonical Note commit resolves. */
export async function commitQuickNotesSend(project:Project,commit:(candidate:Project)=>Promise<Project>){
  const made=captureQuickNotes(project);
  const withSavedNote=await commit(made.project);
  const cleared=clearQuickNotes(withSavedNote);
  const final=await commit(cleared);
  return {project:final,noteId:made.id};
}
