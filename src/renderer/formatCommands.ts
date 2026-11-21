import type {Editor} from '@tiptap/core';
/** Shared toolbar/menu/palette formatting path. Editor plugins retain accounting. */
export function executeFormat(editor:Editor,name:string){
 const chain=editor.chain().focus();
 if(name==='bold')return chain.toggleBold().run();
 if(name==='italic')return chain.toggleItalic().run();
 if(name==='underline')return chain.toggleUnderline().run();
 if(name==='heading')return chain.toggleHeading({level:2}).run();
 if(name==='list')return chain.toggleBulletList().run();
 if(name==='indent')return chain.indentParagraph().run();
 if(name==='outdent')return chain.outdentParagraph().run();
 if(['align-left','align-center','align-right'].includes(name))return chain.alignText(name.slice(6) as 'left'|'center'|'right').run();
 return false;
}
