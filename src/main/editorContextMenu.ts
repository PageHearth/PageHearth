import type {MenuItemConstructorOptions} from 'electron';
export type ReferenceContext={kind:'add'|'remove';token:string;targetId?:string}|null;
/** Reference eligibility comes from the editor snapshot, never the spellchecker. */
export function editorContextMenu(params:{isEditable:boolean;misspelledWord:string;dictionarySuggestions:string[];editFlags:{canCut:boolean;canCopy:boolean;canPaste:boolean;canSelectAll:boolean}},reference:ReferenceContext,actions:{replace:(word:string)=>void;dictionary?:(word:string)=>void;reference:(kind:'add'|'remove',token:string)=>void;open:(targetId:string)=>void}){
  const items:MenuItemConstructorOptions[]=[];
  if(params.isEditable&&params.misspelledWord){
    for(const word of params.dictionarySuggestions)items.push({label:word.replaceAll('&','&&'),click:()=>actions.replace(word)});
    if(!params.dictionarySuggestions.length)items.push({label:'No spelling suggestions',enabled:false});
    if(actions.dictionary)items.push({type:'separator'},{label:'Add to Project Dictionary',click:()=>actions.dictionary!(params.misspelledWord)});
    items.push({type:'separator'});
  }
  if(reference?.kind==='remove'){const targetId=reference.targetId;items.push({label:'Open Reference',enabled:typeof targetId==='string'&&!!targetId,click:()=>{if(targetId)actions.open(targetId);}});}
  if(reference)items.push({label:reference.kind==='add'?'Add Reference…':'Remove Reference',click:()=>actions.reference(reference.kind,reference.token)},{type:'separator'});
  items.push({role:'cut',enabled:params.editFlags.canCut},{role:'copy',enabled:params.editFlags.canCopy},{role:'paste',enabled:params.editFlags.canPaste},{role:'selectAll',enabled:params.editFlags.canSelectAll});
  return items;
}
