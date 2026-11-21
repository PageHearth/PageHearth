import type { Editor } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import type { Doc } from '../shared/model';

// Loading a different document must never put the previous document/project in Undo.
export function replaceDocument(editor: Editor | null, doc: Doc) {
  if(!editor)return;
  const next=editor.schema.nodeFromJSON(doc);next.check();editor.view.dispatch(editor.state.tr.replaceWith(0,editor.state.doc.content.size,next.content).setMeta('continuous-refresh',true).setMeta('preventUpdate',true).setMeta('addToHistory',false));
  editor.view.updateState(EditorState.create({schema:editor.schema,doc:editor.state.doc,plugins:editor.state.plugins}));
}
