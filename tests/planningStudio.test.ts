import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import {Corkboard} from '../src/renderer/Corkboard';
import {Outliner} from '../src/renderer/Outliner';
import {Timeline} from '../src/renderer/Timeline';
import {blank,defaultAuthor,type Project} from '../src/shared/model';
import {addPlanningCard,addReferenceCard} from '../src/shared/author';
function fixture():Project{return {manifest:{version:1,id:crypto.randomUUID(),title:'Planning',revision:0,nodes:[{id:'chapter',parent:null,kind:'Chapter',title:'Chapter'},{id:'scene',parent:'chapter',kind:'Scene',title:'Scene'}],settings:{workspace:{},editor:{},publication:{}}},documents:{chapter:blank(),scene:blank()},author:{...defaultAuthor(),scenes:'available'},recovery:[]};}
it.each(['compact','standard','expanded'])('renders %s planning/reference density without changing canonical data',density=>{
 let project=addReferenceCard(addPlanningCard(fixture(),'chapter','A planning note').project,'chapter','document','scene').project;project.manifest.settings.workspace.corkboard={density};const before=JSON.stringify(project);
 const html=renderToStaticMarkup(React.createElement(Corkboard,{project,contextId:'chapter',onChange:()=>{},onOpen:()=>{},onTreeChange:()=>{}}));
 expect(html).toContain('density-'+density);expect(html).toContain('PLANNING NOTE');expect(html).toContain('REFERENCE');expect(html).toContain('Reset Layout');expect(html).toContain('Clear Corkboard');expect(html).not.toContain('manuscript-drag');expect(html).toContain('Reference Shelf');expect(JSON.stringify(project)).toBe(before);
});
it('exposes structural handles only in explicit manuscript mode, including empty Scene context',()=>{
 const project=fixture();project.manifest.settings.workspace.corkboard={mode:'manuscript'};
 const render=(contextId:string)=>renderToStaticMarkup(React.createElement(Corkboard,{project,contextId,onChange:()=>{},onOpen:()=>{},onTreeChange:()=>{}}));
 expect(render('chapter')).toContain('Reorder manuscript structure: Scene');expect(render('scene')).not.toContain('class="manuscript-drag"');expect(render('scene')).toContain('No child manuscript items');
});
it('Outliner preserves real hierarchy/current state, columns and local move controls',()=>{
 const project=fixture(),before=JSON.stringify(project);const html=renderToStaticMarkup(React.createElement(Outliner,{project,selected:'scene',onSelect:()=>{},onOpen:()=>{},onChange:()=>{},onTreeChange:()=>{}}));
 expect(html).toContain('data-kind="Scene"');expect(html).toContain('aria-selected="true"');expect(html).toContain('Summary for Scene');expect(html).toContain('Undo Outliner structural move');expect(html).toContain('Columns (3)');expect(JSON.stringify(project)).toBe(before);
});
it('Timeline retains chronology-only empty guidance without creating data',()=>{
 const project=fixture(),before=JSON.stringify(project);const html=renderToStaticMarkup(React.createElement(Timeline,{project,onChange:()=>{},onOpen:()=>{}}));expect(html).toContain('manuscript order stays in Story Tree');expect(html).toContain('No timeline events yet');expect(html).toContain('planning-studio');expect(JSON.stringify(project)).toBe(before);
});
