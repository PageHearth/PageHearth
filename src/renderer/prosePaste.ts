import {Extension} from '@tiptap/core';
import {Plugin} from '@tiptap/pm/state';
import {Slice,Fragment,type Schema} from '@tiptap/pm/model';
/** Future plain-text paste only. Rich HTML keeps its semantic blocks; no load-time repair. */
export function plainProseSlice(text:string,schema:Schema){
 const groups=text.replace(/\r\n?/g,'\n').split(/\n[ \t]*\n(?:[ \t]*\n)*|\n(?=\t\S| {4,}\S)/u);
 const nodes=groups.map(group=>{const content=[];for(const [i,line] of group.split('\n').entries()){if(i)content.push(schema.nodes.hardBreak.create());if(line)content.push(schema.text(line));}return schema.nodes.paragraph.create(null,content);});
 return Slice.maxOpen(Fragment.from(nodes));
}
export const ProsePaste=Extension.create({name:'prosePaste',addProseMirrorPlugins(){return [new Plugin({props:{clipboardTextParser:(text,context)=>plainProseSlice(text,context.doc.type.schema)}})];}});
