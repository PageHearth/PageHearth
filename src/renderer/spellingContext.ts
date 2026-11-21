import type {EditorView} from '@tiptap/pm/view';
import {TextSelection} from '@tiptap/pm/state';
import {closeHistory} from '@tiptap/pm/history';
import type {Mark} from '@tiptap/pm/model';
import {spellService} from './spellService';
import {spellingKey,spellingTokenAt} from './spellingDecorations';

const views=new Set<EditorView>();
let addWord:((word:string)=>void)|null=null;
let pending:{id:string;view:EditorView;doc:EditorView['state']['doc'];epoch:number;from:number;to:number;word:string}|null=null;
export function setDictionaryAction(action:((word:string)=>void)|null){addWord=action;pending=null;}
export function registerSpellingView(view:EditorView){views.add(view);return ()=>{views.delete(view);if(pending?.view===view)pending=null;};}
export async function spellingContext(x:number,y:number){
 pending=null;const target=document.elementFromPoint(x,y);const view=[...views].find(v=>!v.isDestroyed&&v.editable&&!!target&&v.dom.contains(target));if(!view||view.composing)return null;
 const pos=view.posAtCoords({left:x,top:y})?.pos;if(pos===undefined)return null;const token=spellingTokenAt(view,pos);if(!token||!spellingKey.getState(view.state)?.decos.find(token.from,token.to).some(d=>d.from===token.from&&d.to===token.to))return null;
 const capture={id:crypto.randomUUID(),view,doc:view.state.doc,epoch:spellService.epoch,...token};pending=capture;
 try{const suggestions=await spellService.suggest(token.word);if(pending!==capture||view.isDestroyed||view.state.doc!==capture.doc||spellService.epoch!==capture.epoch)return null;return {token:capture.id,word:token.word,suggestions};}catch{return null;}
}
export function spellingAction(id:string,action:'add'|'replace',word?:string){
 const p=pending;pending=null;if(!p||p.id!==id||p.view.isDestroyed||p.view.composing||!p.view.editable||p.doc!==p.view.state.doc||p.epoch!==spellService.epoch)return false;
 if(action==='add'){addWord?.(p.word);return true;}
 if(!word||word.length>256)return false;
 const view=p.view;view.focus();view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc,p.from,p.to)).setMeta('addToHistory',false));
 // Existing RevisionInput and ActivityInput consume this ordinary authored input signal.
 view.dom.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,inputType:'insertReplacementText',data:word}));
 // Preserve only marks shared by all replaced text. In particular, a complete
 // explicit-reference label has a non-inclusive mark that insertText would
 // otherwise discard at its end boundary. Never infer or create an occurrence.
 let shared:readonly Mark[]|undefined;
 view.state.doc.nodesBetween(p.from,p.to,node=>{if(node.isText)shared=shared===undefined?node.marks:shared.filter(mark=>node.marks.some(other=>mark.eq(other)));});
 view.dispatch(closeHistory(view.state.tr.setStoredMarks(shared||[]).insertText(word,p.from,p.to)).setMeta('closeHistory$',true).setMeta('revision-origin','text'));
 return true;
}
if(typeof window!=='undefined')Object.assign(window,{__pagehearthSpellingMenu:spellingContext,__pagehearthSpellingAction:spellingAction});
