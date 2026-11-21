import {getSchema,Mark,Extension} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type {Doc} from '../shared/model.js';
// The manuscript uses StarterKit plus these persisted attributes/marks. Import
// intentionally excludes entityReference and presentation-only segment wrappers.
export const importSchema=getSchema([StarterKit,
 Mark.create({name:'textStyle',addAttributes:()=>({fontFamily:{default:null}})}),
 Mark.create({name:'fontSize',addAttributes:()=>({points:{default:null}})}),
 Extension.create({name:'importParagraphAttributes',addGlobalAttributes:()=>[{types:['paragraph','heading'],attributes:{textAlign:{default:null},indent:{default:0}}}]})]);
export function canonicalImportDocument(body:Doc):Doc{
 const visit=(n:Doc):Doc=>({...n,...(n.marks?{marks:[...new Map(n.marks.map(m=>[m.type,m])).values()].sort((a,b)=>(importSchema.marks[a.type] as any).rank-(importSchema.marks[b.type] as any).rank)}:{}),...(n.content?{content:n.content.map(visit)}:{})});
 const node=importSchema.nodeFromJSON(visit(body));node.check();return node.toJSON();
}
