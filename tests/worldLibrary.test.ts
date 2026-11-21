import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,expect,it,vi} from 'vitest';
import {WorldBible} from '../src/renderer/WorldBible';
import {WorldBibleCategoryIcon} from '../src/renderer/WorldBibleCategoryIcon';
import {blank,defaultAuthor,type Project} from '../src/shared/model';
import {createEntity,createCustomCategory,trashEntity,CUSTOM_CATEGORY_ICONS} from '../src/shared/worldBible';
afterEach(()=>vi.unstubAllGlobals());
it('renders every actual category, active counts, custom icon and existing management without changing the manuscript',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false}));const id=crypto.randomUUID();let p:Project={manifest:{version:1,id:crypto.randomUUID(),title:'Library',revision:0,nodes:[{id,parent:null,title:'One',kind:'Chapter'}],settings:{editor:{},publication:{},workspace:{}}},documents:{[id]:blank()},author:defaultAuthor(),recovery:[]};
 const a=createEntity(p,'character','A');p=a.project;const b=createEntity(p,'character','B');p=trashEntity(b.project,b.id);const custom=createCustomCategory(p,'Keepsakes','Keepsake','Useful objects','gem');p=custom.project;
 const before=JSON.stringify(p),change=vi.fn(),html=renderToStaticMarkup(React.createElement(WorldBible,{project:p,onChange:change}));
 for(const name of ['Characters','Locations','Bestiary','Factions','Lore','Glossary','Systems / Magic','Keepsakes','Manage Categories','+ Add Category'])expect(html).toContain(name);
 expect(html.match(/class="category-card/g)).toHaveLength(8);expect(html).toContain('1 entry');expect(html).toContain('0 entries');expect(html).toContain('world-category-icon');expect(html).not.toContain('Decorative branching story tree');expect(change).not.toHaveBeenCalled();expect(JSON.stringify(p)).toBe(before);
});
it('renders each configured custom icon in one accessible decorative outline family',()=>{for(const kind of CUSTOM_CATEGORY_ICONS){const html=renderToStaticMarkup(React.createElement(WorldBibleCategoryIcon,{kind}));expect(html).toContain('aria-hidden="true"');expect(html).toContain('stroke="currentColor"');expect(html).toContain('viewBox="0 0 24 24"');}});
