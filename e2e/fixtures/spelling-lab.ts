import {Editor,Extension} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {spellingPlugin,spellingKey,spellingTokenAt} from '../../src/renderer/spellingDecorations';
import {SpellService} from '../../src/renderer/spellService';
import {defaultAuthor} from '../../src/shared/model';
import {changeDictionary} from '../../src/shared/spelling';
import {ManuscriptDocument,ManuscriptSegment} from '../../src/renderer/continuous';
const w=window as any;
const service=new SpellService(request=>w.baseSpell(request));
let editor:Editor|null=null,project:any={manifest:{id:'lab'},author:defaultAuthor()};
service.update(project);
const settle=async()=>{const started=performance.now();while(editor&&spellingKey.getState(editor.state)!.dirty.length){if(performance.now()-started>10000)throw Error('Spelling did not settle');await new Promise(r=>setTimeout(r,1));}};
w.spellingLab={service,settle,key:spellingKey,tokenAt:spellingTokenAt,
 create(count:number,continuous=false){editor?.destroy();document.querySelector('#lab')?.remove();const el=document.createElement('div');el.id='lab';el.style.cssText='width:700px;height:500px;overflow:auto';document.body.append(el);const paragraph=(n:number)=>({type:'paragraph',content:[{type:'text',text:'word '.repeat(n-1)+'recieve'}]});const content=continuous?{type:'doc',content:Array.from({length:500},(_,i)=>({type:'manuscriptSegment',attrs:{documentId:'document-'+i},content:[paragraph(count/500)]}))}:{type:'doc',content:[paragraph(count)]};const plugin=Extension.create({name:'labSpelling',addProseMirrorPlugins(){return [spellingPlugin(service)];}});editor=new Editor({element:el,extensions:[StarterKit.configure(continuous?{document:false}:{}),...(continuous?[ManuscriptDocument,ManuscriptSegment]:[]),plugin],content});return editor;},
 editor:()=>editor,
 dictionary(count:number){project={...project,author:{...project.author,projectDictionary:{version:1,entries:Array.from({length:count},(_,i)=>({spelling:'Fiction'+i.toString(26).replace(/[0-9a-p]/g,c=>String.fromCharCode(65+parseInt(c,26)))}))}}};service.update(project);},
 glossary(count:number){project={...project,author:{...project.author,worldBible:{...project.author.worldBible,entities:Array.from({length:count},(_,i)=>({id:'glossary-'+i,type:'glossary',name:'Glossary'+i.toString(26).replace(/[0-9a-p]/g,c=>String.fromCharCode(65+parseInt(c,26))),aliases:[]}))}}};service.update(project);},
 approve(word:string,add=true){project=changeDictionary(project,word,add?'add':'remove');service.update(project);},
 caseRule(word:string,value:boolean){project=changeDictionary(project,word,'case',value);service.update(project);},
 switch(){project={...project,manifest:{id:project.manifest.id==='lab'?'other':'lab'},author:defaultAuthor()};service.update(project);},
 destroy(){editor?.destroy();editor=null;return service.listeners.size;}
};
