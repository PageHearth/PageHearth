import { Extension, type Command } from '@tiptap/core';
declare module '@tiptap/core' {
  interface Commands<ReturnType> { paragraphIndent: { indentParagraph:()=>ReturnType; outdentParagraph:()=>ReturnType } }
}
export const ParagraphIndent=Extension.create({
  name:'paragraphIndent',
  addGlobalAttributes(){return [{types:['paragraph','heading'],attributes:{indent:{default:0,parseHTML:element=>Math.max(0,Math.min(8,Math.round(Number(element.getAttribute('data-indent'))||0))),renderHTML:attrs=>attrs.indent ? {'data-indent':attrs.indent,style:`text-indent: ${attrs.indent*2}em`} : {}}}}];},
  addCommands(){
    const adjust=(direction:number):(()=>Command) => ()=>({state,dispatch})=>{
      const tr=state.tr;state.doc.nodesBetween(state.selection.from,state.selection.to,(node,pos)=>{if(node.type.name==='paragraph' || node.type.name==='heading'){const indent=Math.max(0,Math.min(8,(node.attrs.indent || 0)+direction));if(indent!==node.attrs.indent)tr.setNodeMarkup(pos,undefined,{...node.attrs,indent});}});
      if(dispatch && tr.docChanged)dispatch(tr);
      return true;
    };
    return {indentParagraph:adjust(1),outdentParagraph:adjust(-1)};
  },
  addKeyboardShortcuts(){return {Tab:()=>!this.editor.view.composing && this.editor.commands.indentParagraph(),'Shift-Tab':()=>!this.editor.view.composing && this.editor.commands.outdentParagraph()};},
});
