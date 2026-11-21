import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {StoryTree} from '../src/renderer/StoryTree';
import {Inspector} from '../src/renderer/Inspector';
import {blank,defaultAuthor,type Project} from '../src/shared/model';

function fixture():Project{return {manifest:{version:1,id:crypto.randomUUID(),title:'Writing desk',revision:0,nodes:[{id:'part',parent:null,kind:'Part',title:'Long Part title'},{id:'chapter',parent:'part',kind:'Chapter',title:'Chapter title'},{id:'scene',parent:'chapter',kind:'Scene',title:'Long Scene planning name'}],settings:{workspace:{},editor:{},publication:{}}},documents:{chapter:blank(),scene:blank()},author:{...defaultAuthor(),scenes:'available'},recovery:[]};}
it('exposes kind hierarchy and independent current/group states without changing the project',()=>{
 const project=fixture(),before=JSON.stringify(project);
 const html=renderToStaticMarkup(React.createElement(StoryTree,{project,selected:'scene',busy:false,onSelect:()=>{},onChange:async()=>{},onAdd:()=>{}}));
 for(const kind of ['Part','Chapter','Scene'])expect(html).toContain('data-kind="'+kind+'"');
 expect(html).toContain('aria-current="true"');expect(html).toContain('title="Long Scene planning name"');
 for(const label of ['View Trash','Story Tree Help','Add Chapter or Scene'])expect(html).toContain('aria-label="'+label+'"');
 expect(html).not.toContain('type="checkbox"');expect(JSON.stringify(project)).toBe(before);
});
it('retains accessible collapsible Inspector controls and canonical metadata untouched',()=>{
 const project=fixture(),before=JSON.stringify(project);
 const html=renderToStaticMarkup(React.createElement(Inspector,{project,selected:'scene',pinned:null,onPin:()=>{},onChange:()=>{},onOpenNote:()=>{}}));
 for(const label of ['Comments','History','Summary','Story Metadata','Notes','References','Custom Fields'])expect(html).toContain(label);
 expect(html).toContain('aria-expanded="true"');expect(html).toContain('aria-label="Comment state"');expect(JSON.stringify(project)).toBe(before);
});

it.each(['Scene','Chapter','Part','Folder'] as const)('anchors %s identity before Comments and preserves pin target',kind=>{
 const project=fixture();project.documents.target=blank();project.manifest.nodes.push({id:'target',parent:'part',kind,title:'A long planning title that wraps naturally across multiple Inspector lines'});
 const html=renderToStaticMarkup(React.createElement(Inspector,{project,selected:'scene',pinned:'target',onPin:()=>{},onChange:()=>{},onOpenNote:()=>{}}));
 expect(html.indexOf('inspector-identity')).toBeLessThan(html.indexOf('comments-section'));expect(html).toContain('<small>'+kind+'</small>');expect(html).toContain('A long planning title');expect(html).toContain('Unpin');
});
