import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {focusDecorations,focusPreferences,sentenceRange,visualParagraphRange} from '../src/renderer/textFocus';
import {ManuscriptDocument,ManuscriptSegment} from '../src/renderer/continuous';
import {commandForInput,commandBinding} from '../src/shared/commands';
import {focusMenu} from '../src/main/focusMenu';
it.each(['off','sentence','paragraph'] as const)('native menu reflects %s and sends every selectable command once',text=>{const sent:unknown[]=[];const menu=focusMenu({text,typewriter:true},true,c=>sent.push(c));const items=menu[0].submenu as any[];expect(items.map(x=>[x.id,x.type,x.checked,x.enabled])).toEqual(['off','sentence','paragraph'].map(x=>['text-focus-'+x,'radio',x===text,true]));for(const item of items)item.click();(menu[1].click as Function)();expect(sent).toEqual([{kind:'text-focus-off'},{kind:'text-focus-sentence'},{kind:'text-focus-paragraph'},{kind:'typewriter-toggle'}]);expect(menu[1].checked).toBe(true);});
it('native menu disables choices outside WRITE without owning or resetting preferences',()=>{const state={text:'paragraph' as const,typewriter:false};const menu=focusMenu(state,false,()=>{});expect(menu[1].enabled).toBe(false);expect((menu[0].submenu as any[])[2].checked).toBe(true);expect(state).toEqual({text:'paragraph',typewriter:false});});
const schema=getSchema([StarterKit.configure({document:false}),ManuscriptDocument,ManuscriptSegment]);
const paragraph=(text:string)=>schema.node('paragraph',null,schema.text(text));
it('visual paragraphs split only blank hard-break lines, with deterministic separator ownership',()=>{
 expect(visualParagraphRange('One\nline\n\nTwo',3)).toEqual([0,8]);
 expect(visualParagraphRange('One\nline\n\nTwo',9)).toEqual([0,8]);
 expect(visualParagraphRange('One\nline\n\nTwo',10)).toEqual([10,13]);
 expect(visualParagraphRange('A\n \t\n\nB',7)).toEqual([6,7]);
 expect(visualParagraphRange('\n\nA\n\n',5)).toEqual([5,5]);
});
it.each([false,true])('blank-line focus isolates five pasted sections without altering canonical data (Continuous %s)',continuous=>{
 const children=[];for(let i=0;i<5;i++){if(i)children.push(schema.node('hardBreak'),schema.node('hardBreak'));children.push(schema.text('Section '+i+'. More prose.',[schema.mark('bold')]));}
 const p=schema.node('paragraph',null,children),doc=schema.node('doc',null,continuous?[schema.node('manuscriptSegment',{documentId:'chapter'},[p])]:[p]);const before=JSON.stringify(doc.toJSON());const base=continuous?2:1;
 let offset=0;for(let i=0;i<5;i++){const length=('Section '+i+'. More prose.').length;const s=EditorState.create({doc,selection:TextSelection.create(doc,base+offset+3)});const decorations=focusDecorations(s,'paragraph').find();const active=decorations.filter(d=>(d as any).type.attrs.class==='focus-current-visual-paragraph');expect(active.map(d=>[d.from,d.to])).toEqual([[base+offset,base+offset+length]]);expect((decorations[0] as any).type.attrs.class).toBe('focus-current-block focus-visual-band');expect(focusDecorations(s,'sentence').find().some(d=>(d as any).type.attrs.class==='focus-current-sentence')).toBe(true);expect(JSON.stringify(doc.toJSON())).toBe(before);offset+=length+2;}
 expect(doc.textContent).not.toContain('focus-');
});
function state(continuous=false){const p=paragraph('First sentence. Second sentence! Third?');const doc=schema.node('doc',null,continuous?[schema.node('manuscriptSegment',{documentId:'a'},[p]),schema.node('manuscriptSegment',{documentId:'b'},[paragraph('Other prose.')])]:[p,paragraph('Other prose.')]);return EditorState.create({doc,selection:TextSelection.create(doc,continuous?20:19)});}
it('defaults preferences safely and never includes active Focus startup state',()=>{expect(focusPreferences(undefined)).toEqual({text:'off',typewriter:false});expect(focusPreferences({text:'paragraph',typewriter:true,active:true})).toEqual({text:'paragraph',typewriter:true});expect(focusPreferences({text:'invalid',typewriter:1})).toEqual({text:'off',typewriter:false});});
it('segments sentences at caret including paragraph end and Unicode',()=>{expect(sentenceRange('One. Two!',6)).toEqual([5,9]);expect(sentenceRange('One. Two!',9)).toEqual([5,9]);expect(sentenceRange('你好。再见。',4)).toEqual([3,6]);});
it('Off produces no decorations',()=>expect(focusDecorations(state(),'off').find()).toEqual([]));
it('Paragraph decorates only caret block without mutating rich text',()=>{const s=state(),before=s.doc.toJSON();const d=focusDecorations(s,'paragraph').find();expect(d).toHaveLength(1);expect(d[0].from).toBe(0);expect(s.doc.toJSON()).toEqual(before);});
it('Sentence subdues only surrounding ranges inside current paragraph',()=>{const s=state(),d=focusDecorations(s,'sentence').find();expect(d).toHaveLength(4);expect(d.map(x=>[x.from,x.to])).toContainEqual([1,17]);expect(d.map(x=>[x.from,x.to])).toContainEqual([34,40]);expect(d.map(x=>[x.from,x.to])).toContainEqual([17,34]);});
it('Continuous caret decorations stay inside the actual segment',()=>{const s=state(true);expect(focusDecorations(s,'paragraph').find()[0].from).toBe(1);expect(s.doc.childCount).toBe(2);});
it('F8 routes canonically without changing established F6/F11 and note bindings',()=>{expect(commandForInput({key:'F8',control:false,alt:false,shift:false,meta:false})).toBe('focus-mode');expect(commandForInput({key:'F9',control:false,alt:false,shift:false,meta:false})).toBeUndefined();expect(commandForInput({key:'F11',control:false,alt:false,shift:false,meta:false})).toBeUndefined();expect(commandBinding('quicknotes')).toBe('Ctrl+Shift+M');expect(commandBinding('notebook')).toBe('Ctrl+Alt+N');});
it('focus ranges stay local in a 80k-word document',()=>{const doc=schema.node('doc',null,Array.from({length:2000},()=>paragraph('Surrounding prose remains readable. '.repeat(10))));const s=EditorState.create({doc,selection:TextSelection.create(doc,doc.content.size-8)});expect(focusDecorations(s,'sentence').find().length).toBeLessThanOrEqual(4);expect(focusDecorations(s,'paragraph').find()[0].from).toBeGreaterThan(doc.content.size-500);});
it.each(['paragraph','heading','listItem','continuous'])('Paragraph follows the complete %s textblock with immutable structure',kind=>{
 const text=paragraph('First sentence. Second sentence.');const focused=kind==='heading'?schema.node('heading',{level:2},text.content):text;
 const nested=kind==='listItem'?schema.node('bulletList',null,[schema.node('listItem',null,[focused])]):kind==='continuous'?schema.node('manuscriptSegment',{documentId:'second'},[focused]):focused;
 const doc=schema.node('doc',null,kind==='continuous'?[schema.node('manuscriptSegment',{documentId:'first'},[paragraph('Before.')]),nested]:[paragraph('Before.'),nested]);const before=doc.toJSON();let pos=0;doc.descendants((n,p)=>{if(n===focused)pos=p;});
 for(const offset of [1,8,focused.content.size]){const s=EditorState.create({doc,selection:TextSelection.create(doc,pos+offset)});const d=focusDecorations(s,'paragraph').find();expect(d).toHaveLength(1);expect([d[0].from,d[0].to]).toEqual([pos,pos+focused.nodeSize]);expect((d[0] as any).type.attrs.class).toContain('focus-current-paragraph');expect(s.doc.toJSON()).toEqual(before);}
});
it('focus transfers across blocks and remains absent from document JSON and serialized text',()=>{
 const doc=schema.node('doc',null,[paragraph('First. Second.'),paragraph('Third. Fourth.')]);const before=JSON.stringify(doc.toJSON());let s=EditorState.create({doc,selection:TextSelection.create(doc,2)});expect(focusDecorations(s,'paragraph').find()[0].from).toBe(0);
 s=s.apply(s.tr.setSelection(TextSelection.create(doc,doc.child(0).nodeSize+3)));expect(focusDecorations(s,'paragraph').find()[0].from).toBe(doc.child(0).nodeSize);
 for(const mode of ['paragraph','sentence','off','paragraph'] as const){focusDecorations(s,mode);expect(JSON.stringify(s.doc.toJSON())).toBe(before);}expect(before).not.toContain('focus-current');
});
