import {expect,it,vi} from 'vitest';
import {editorContextMenu} from '../src/main/editorContextMenu';
const params={isEditable:true,misspelledWord:'',dictionarySuggestions:[] as string[],editFlags:{canCut:true,canCopy:true,canPaste:true,canSelectAll:true}};
function actions(){return {open:vi.fn(),replace:vi.fn(),dictionary:vi.fn(),reference:vi.fn()};}
it.each(['','mispelled'])('composes Add Reference independently of spelling: %s',word=>{
 const a=actions(),menu=editorContextMenu({...params,misspelledWord:word,dictionarySuggestions:word?['misspelled']:[]},{kind:'add',token:'snapshot'},a);
 expect(menu.map(x=>x.label)).toContain('Add Reference…');
 (menu.find(x=>x.label==='Add Reference…')!.click as Function)();expect(a.reference).toHaveBeenCalledWith('add','snapshot');
 expect(menu.filter(x=>x.role).map(x=>x.role)).toEqual(['cut','copy','paste','selectAll']);
 if(word){(menu.find(x=>x.label==='misspelled')!.click as Function)();expect(menu.some(x=>x.label==='Add to Project Dictionary')).toBe(true);expect(a.replace).toHaveBeenCalledWith('misspelled');expect(a.dictionary).not.toHaveBeenCalled();}
});
it('retains suggestions and reference actions without dictionary mutation with no spelling suggestions',()=>{
 const menu=editorContextMenu({...params,misspelledWord:'zzz'},{kind:'add',token:'x'},actions());expect(menu.map(x=>x.label)).toEqual(expect.arrayContaining(['No spelling suggestions','Add Reference…']));
});
it('no selection/ambiguous context has no reference action; occurrence removal is independent of spelling',()=>{
 const a=actions();expect(editorContextMenu(params,null,a).some(x=>x.label?.includes('Reference'))).toBe(false);
 const menu=editorContextMenu(params,{kind:'remove',token:'occurrence'},a);expect(menu.some(x=>x.label==='Add Reference…')).toBe(false);(menu.find(x=>x.label==='Remove Reference')!.click as Function)();expect(a.reference).toHaveBeenCalledWith('remove','occurrence');
});

it('Open precedes Remove, shares snapshot token and preserves spelling/edit actions',()=>{const a=actions(),menu=editorContextMenu({...params,misspelledWord:'Minaa',dictionarySuggestions:['Mina']},{kind:'remove',token:'same-occurrence',targetId:'canonical-id'},a);expect(menu.findIndex(x=>x.label==='Open Reference')).toBeLessThan(menu.findIndex(x=>x.label==='Remove Reference'));(menu.find(x=>x.label==='Open Reference')!.click as Function)();expect(a.open).toHaveBeenCalledWith('canonical-id');expect(a.reference).not.toHaveBeenCalled();expect(menu.map(x=>x.label)).toEqual(expect.arrayContaining(['Mina','Remove Reference']));expect(menu.filter(x=>x.role)).toHaveLength(4);});
