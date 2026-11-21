import {blank,defaultAuthor,type Project,type Doc} from '../../src/shared/model';
import {createEntity} from '../../src/shared/worldBible';
import {createNote,addPlanningCard} from '../../src/shared/author';
import {createCollection} from '../../src/shared/collections';
import {createResearchItem} from '../../src/shared/research';
import {createEvent,createTrack} from '../../src/shared/timeline';
export const rich=(text:string):Doc=>({type:'doc',content:[{type:'paragraph',content:text?[{type:'text',text}]:undefined}]});
export function searchFixture(){const id=crypto.randomUUID();let p:Project={manifest:{version:1,id:crypto.randomUUID(),title:'Search fixture',revision:0,nodes:[{id,parent:null,title:'Harbor chapter',kind:'Chapter'}],settings:{editor:{},publication:{},workspace:{selected:id}}},documents:{[id]:rich('First lantern. Second lantern. Final lantern.')},author:defaultAuthor(),recovery:[]};
 p=createNote(p,null,'Harbor note',rich('Notebook lantern one. Notebook lantern two.')).project;
 for(const type of ['character','location','bestiary','lore','glossary'] as const)p=createEntity(p,type,'Harbor '+type).project;
 p=createResearchItem(p,{title:'Harbor research',type:'text',ownership:'none',body:rich('Research lantern'),searchableText:'extracted secret'}).project;
 p=createCollection(p,'Harbor collection',rich('Collection lantern')).project;
 p=createEvent(p,'Harbor event').project;p.author.timeline!.events[0].notes='Timeline lantern';p=createTrack(p,'Harbor track').project;
 p=addPlanningCard(p,id,'Planning lantern').project;p.author.quickNotes.text='Quick lantern';return p;
}
