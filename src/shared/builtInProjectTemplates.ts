import {emptyBlueprint,templateMetadata,validateTemplate,type ProjectTemplate} from './projectTemplates.js';

// Compiled into dist-main/shared and the renderer bundle: no development-path resource lookup.
const definitions=[
  ['blank','Blank','Draft','Start writing in Draft. Use Notebook for your own notes, World Bible for explicit story records, and Research for source material. These tools are optional.'],
  ['novel','Novel','Chapter 1','Write in Chapter 1 and add or rename Chapters in the Story Tree. Scenes are available when you want smaller manuscript documents; no Scenes are required.'],
  ['scenes','Novel with Scenes','Chapter 1','Start writing in Scene 1 inside Chapter 1. Each Scene is a canonical manuscript document. Move Scenes using Story Tree or Outliner. You can organize separate Scene documents instead of keeping all prose in one Chapter; this template does not automatically split existing text. Corkboard and Outliner help organize the same manuscript.'],
  ['short','Short Story','Story','Write in Story. It is a normal Chapter document with a lighter starting title. Add optional Scenes when useful. Notebook, World Bible and Research remain available without requiring additional setup.'],
] as const;
export const BUILT_IN_TEMPLATE_IDS=definitions.map((_,i)=>`00000000-0000-4000-9001-00000000000${i+1}`);
export function builtInProjectTemplates():ProjectTemplate[]{return definitions.map(([slug,name,title,help],i)=>{const b=emptyBlueprint();b.nodes[0].title=title;if(slug==='scenes'){b.nodes.push({key:'scene-one',parent:'draft',title:'Scene 1',kind:'Scene'});b.active='scene-one';}b.notebook.notes=[{key:'getting-started',folder:null,title:'Getting Started',order:0,body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:help}]}]}}];const t:ProjectTemplate={...templateMetadata(name,'PageHearth',help),templateId:BUILT_IN_TEMPLATE_IDS[i],blueprint:b};validateTemplate(t);return t;});}
export function builtInProjectTemplate(id:string){return builtInProjectTemplates().find(t=>t.templateId===id);}
