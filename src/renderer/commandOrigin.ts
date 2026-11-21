import {Mark} from '@tiptap/pm/model';
import type {ManuscriptPanes} from './manuscriptPanes';
/** Ephemeral evidence only. Reading this never emits, persists or dispatches. */
export function captureCommandOrigin(panes:ManuscriptPanes,projectId:string|undefined){const pane=panes.active;return {projectId,epoch:panes.epoch,paneId:pane.id,documentId:pane.documentId,doc:pane.editor.state.doc,selection:pane.editor.state.selection,marks:pane.editor.state.storedMarks,scope:pane.scope};}
export function validCommandOrigin(c:ReturnType<typeof captureCommandOrigin>,panes:ManuscriptPanes,projectId:string|undefined){const p=panes.active;return c.projectId===projectId&&c.epoch===panes.epoch&&c.paneId===p.id&&c.documentId===p.documentId&&!p.editor.isDestroyed&&c.doc.eq(p.editor.state.doc)&&c.selection.eq(p.editor.state.selection)&&Mark.sameSet(c.marks||[],p.editor.state.storedMarks||[])&&c.scope===p.scope;}
