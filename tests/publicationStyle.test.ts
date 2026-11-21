import {describe,it,expect} from 'vitest';
import {defaultPublication} from '../src/shared/publication';
import {inspectStyleMigration,reconcilePublicationStyle,resolveSharedAppearance,sharedPrintAppearance,validateSharedPublicationStyle,passageStyleKey,type StyleChoices} from '../src/shared/publicationStyle';
import legacy from './fixtures/legacy-print-variant-shape.json';
import {adoptPublicationStyle,publicationRenderPlan} from '../src/shared/publicationStyleAdapter';
import type {PublicationVariant} from '../src/shared/publicationVariants';
import type {EbookRegionOverride} from '../src/shared/ebookRegions';

const first='11111111-1111-4111-8111-111111111111';
const second='22222222-2222-4222-8222-222222222222';
function plan(){const p=defaultPublication('Shared style');p.style.print.font='Libertinus Serif';return p;}
function allPrint(p:ReturnType<typeof plan>):StyleChoices{return Object.fromEntries(inspectStyleMigration(p).conflicts.map(c=>[c.id,{use:'print' as const}]));}
describe('shared publication migration',()=>{
 it('case A adopts an eBook-only variant font without writing the source',()=>{
  const p=plan();p.specialTextVariants=[{id:first,role:'letter',name:'First',treatments:{ebook:{family:'Ink Free',fontPolicy:'embedded',licenseConfirmed:true}}}];
  const before=structuredClone(p),result=inspectStyleMigration(p);
  expect(result.conflicts).toEqual([]);expect(result.style.variants[first]).toEqual({family:'Ink Free'});
  expect(result.style.ebookPermissions['variants/'+first]).toEqual({policy:'embedded',licenseConfirmed:true});expect(p).toEqual(before);
 });
 it('case A adopts Print-only role, passage and chapter appearance in neutral units',()=>{
  const p=plan();p.style.specialText={poem:{font:'Georgia',sizePt:22,leftPt:16.2,rightPt:16.2,spacePt:11,indentPt:11,italic:true}};
  p.production={chapterFont:'Georgia',chapterSize:22,chapterAlign:'center',chapterAbove:22,chapterBelow:11,headerLeft:'author',headerRight:'title',footer:'center'};
  p.ebook.options={profile:'generic',font:'reader-default',paragraphs:'indented',regions:[{sourceKind:'manuscript',sourceId:'chapter',regionId:first,role:'poem',printStyle:{font:'Ink Free'}}]};
  const result=inspectStyleMigration(p);
  expect(result.style.roles.poem).toEqual({family:'Georgia',size:2,insetStart:5,insetEnd:5,paragraphSpace:.5,indent:.5,italic:true});
  expect(result.style.chapters).toMatchObject({family:'Georgia',size:2,spaceAbove:2,spaceBelow:1});
  expect(result.style.passages[passageStyleKey(p.ebook.options.regions![0])]).toEqual({family:'Ink Free'});
 });
 it('case B merges equal explicit values after adapting units',()=>{
  const p=plan();p.style.specialText={letter:{font:'Ink Free',sizePt:22,leftPt:16.2,spacePt:11,alignment:'right'}};
  p.ebook.options={profile:'generic',font:'reader-default',paragraphs:'indented',specialText:{letter:{family:'Ink Free',size:2,insetStart:5,paragraphSpace:.5,alignment:'end'}}};
  const r=inspectStyleMigration(p);expect(r.conflicts.filter(c=>c.layer==='roles/letter')).toEqual([]);
  expect(r.style.roles.letter).toEqual({family:'Ink Free',size:2,insetStart:5,paragraphSpace:.5,alignment:'end'});
 });
 it('converts sparse Print spacing against the inherited role/variant size',()=>{
  const p=plan();p.style.specialText={letter:{sizePt:22}};
  p.specialTextVariants=[{id:first,role:'letter',name:'First',treatments:{print:{spacePt:11},ebook:{paragraphSpace:.5}}}];
  p.ebook.options={profile:'generic',font:'reader-default',paragraphs:'indented',regions:[{sourceKind:'manuscript',sourceId:'chapter',regionId:second,role:'letter',variantId:first,printStyle:{spacePt:22},style:{paragraphSpace:1}}]};
  const result=inspectStyleMigration(p);expect(result.style.variants[first].paragraphSpace).toBe(.5);
  expect(result.style.passages[passageStyleKey(p.ebook.options.regions![0])].paragraphSpace).toBe(1);
  expect(result.conflicts.filter(c=>c.property==='paragraphSpace')).toEqual([]);
 });
 it('case C leaves differing appearance unresolved and requires every deliberate choice',()=>{
  const p=plan();p.specialTextVariants=[{id:first,role:'letter',name:'First',treatments:{print:{font:'Georgia',italic:false},ebook:{family:'Ink Free',italic:true}}}];
  const r=inspectStyleMigration(p);expect(r.conflicts).toHaveLength(2);expect(r.style.variants[first]).toEqual({});
  expect(()=>reconcilePublicationStyle(p,{})).toThrow('Needs style reconciliation');
  const choices:StyleChoices={['variants/'+first+'/family']:{use:'ebook'},['variants/'+first+'/italic']:{use:'print'}};
  expect(reconcilePublicationStyle(p,choices).variants[first]).toEqual({family:'Ink Free',italic:false});
  choices['variants/'+first+'/family']={use:'custom',value:'Arial'};expect(reconcilePublicationStyle(p,choices).variants[first].family).toBe('Arial');
  choices['variants/'+first+'/family']={use:'custom',value:'bad\nfont'};expect(()=>reconcilePublicationStyle(p,choices)).toThrow();
 });
 it('does not infer that mandatory legacy paragraph defaults were never edited',()=>{
  const p=plan();p.ebook.options={profile:'generic',font:'reader-default',paragraphs:'indented'};
  expect(inspectStyleMigration(p).conflicts.map(c=>c.id)).toEqual(['body/indent']);
  expect(reconcilePublicationStyle(p,{'body/indent':{use:'ebook'}}).body.indent).toBe(1);
 });
 it('detects body font and scene boundary conflicts separately from font permission',()=>{
  const p=plan();p.ebook.options={profile:'generic',font:'reader-default',paragraphs:'spaced',sceneBoundary:'none',embeddedFont:{family:'Ink Free',licenseConfirmed:false}};
  const r=inspectStyleMigration(p);expect(r.conflicts.map(c=>c.id)).toEqual(expect.arrayContaining(['body/family','body/indent','body/paragraphSpace','sceneBoundary']));
  expect(r.style.ebookPermissions.body).toEqual({policy:'embedded',licenseConfirmed:false});
  const choices=allPrint(p);choices.sceneBoundary={use:'ebook'};
  const s=reconcilePublicationStyle(p,choices);expect(s.sceneBoundary).toBe('none');expect(s.body.family).toBe('Libertinus Serif');
 });
 it('does not transfer legacy font permission when reconciliation chooses another family',()=>{
  const p=plan();p.specialTextVariants=[{id:first,role:'letter',name:'First',treatments:{print:{font:'Georgia'},ebook:{family:'Ink Free',fontPolicy:'embedded',licenseConfirmed:true}}}];
  expect(reconcilePublicationStyle(p,{['variants/'+first+'/family']:{use:'print'}}).ebookPermissions['variants/'+first].licenseConfirmed).toBe(false);
  expect(reconcilePublicationStyle(p,{['variants/'+first+'/family']:{use:'ebook'}}).ebookPermissions['variants/'+first].licenseConfirmed).toBe(true);
  expect(reconcilePublicationStyle(p,{['variants/'+first+'/family']:{use:'custom',value:'Arial'}}).ebookPermissions['variants/'+first].licenseConfirmed).toBe(false);
 });
 it('does not reactivate a cached family after legacy Follow Body or Reader was selected',()=>{
  const p=plan();p.ebook.options={profile:'generic',font:'reader-default',paragraphs:'indented',specialText:{letter:{fontPolicy:'body',family:'Ink Free',licenseConfirmed:true},poem:{fontPolicy:'reader',family:'Georgia',licenseConfirmed:true}}};
  const {style}=inspectStyleMigration(p);expect(style.roles.letter?.family).toBeUndefined();expect(style.roles.poem?.family).toBeUndefined();expect(style.ebookPermissions['roles/letter']).toEqual({policy:'body'});expect(style.ebookPermissions['roles/poem']).toEqual({policy:'reader'});expect(p.ebook.options.specialText!.letter!.family).toBe('Ink Free');
 });
 it('rejects stale/unknown decisions and ambiguous passage assignments',()=>{
  const p=plan();expect(()=>reconcilePublicationStyle(p,{stale:{use:'print'}})).toThrow('changed');
  const r={sourceKind:'manuscript' as const,sourceId:'chapter',regionId:first,role:'letter' as const};
  p.ebook.options={profile:'generic',font:'reader-default',paragraphs:'indented',regions:[r,{...r}]};
  expect(()=>inspectStyleMigration(p)).toThrow('Ambiguous');
 });
 it('validates unsupported versions, unknown fields, roles, permissions and nonfinite units',()=>{
  const s=inspectStyleMigration(plan()).style;
  for(const invalid of [{...s,version:2},{...s,other:true},{...s,roles:{unknown:{}}},{...s,body:{size:Infinity}},{...s,body:{family:'x\ny'}},{...s,ebookPermissions:{body:{licenseConfirmed:'yes'}}}])expect(()=>validateSharedPublicationStyle(invalid)).toThrow();
 });
 it('keeps real-project sanitized variant identity and sparse legacy evidence unchanged',()=>{
  // Fixture contains no original prose or private project IDs.
  const p=plan();p.style.specialText=structuredClone(legacy.roleStyles);
  p.specialTextVariants=structuredClone(legacy.variants) as PublicationVariant[];
  p.ebook.options={profile:'generic',font:'reader-default',paragraphs:'indented',regions:structuredClone(legacy.regions) as EbookRegionOverride[]};
  p.specialTextVariants[1].treatments.print={font:'KiwiSoda'};
  const before=JSON.stringify(p);const r=inspectStyleMigration(p);
  expect(r.style.variants[legacy.variants[0].id].family).toBe('04b');expect(r.conflicts.some(c=>c.layer==='variants/'+legacy.variants[1].id)).toBe(true);
  expect(r.style.passages[passageStyleKey(legacy.regions[0])].family).toBe('Airstrike Outline');expect(JSON.stringify(p)).toBe(before);
 });
});
describe('renderer projection boundary',()=>{
 it('adoption preserves all legacy evidence and refuses accidental re-migration',()=>{
  const p=plan(),before=structuredClone(p),adopted=adoptPublicationStyle(p,{});
  expect(p).toEqual(before);expect(adopted.style).toEqual(p.style);expect(adopted.ebook).toEqual(p.ebook);
  expect(()=>adoptPublicationStyle(adopted,{})).toThrow('already');
 });
 it('projects one body/role/variant/passsage definition into both legacy renderer interfaces',()=>{
  const p=adoptPublicationStyle(plan(),{}),s=p.bookStyle!;
  s.body.family='Libertinus Serif';s.ebookPermissions.body={licenseConfirmed:true};
  s.roles.letter={family:'Georgia',italic:true};s.ebookPermissions['roles/letter']={licenseConfirmed:true};
  s.variants[first]={family:'Ink Free',size:1.2};s.ebookPermissions['variants/'+first]={licenseConfirmed:true};
  p.specialTextVariants=[{id:first,role:'letter',name:'Handwriting',treatments:{ebook:{}}}];
  const r={sourceKind:'manuscript' as const,sourceId:'chapter',regionId:second,role:'letter' as const,variantId:first};
  p.ebook.options={profile:'generic',font:'reader-default',paragraphs:'indented',regions:[r]};
  s.passages[passageStyleKey(r)]={family:'Arial'};
  const before=structuredClone(p),out=publicationRenderPlan(p);
  expect(out.style.print.font).toBe('Libertinus Serif');expect(out.ebook.options!.embeddedFont!.family).toBe('Libertinus Serif');
  expect(out.style.specialText!.letter!.font).toBe('Georgia');expect(out.ebook.options!.specialText!.letter!.family).toBe('Georgia');
  expect(out.specialTextVariants![0].treatments.print!.font).toBe('Ink Free');expect(out.specialTextVariants![0].treatments.ebook.family).toBe('Ink Free');
  expect(out.ebook.options!.regions![0].printStyle!.font).toBe('Arial');expect(out.ebook.options!.regions![0].style!.family).toBe('Arial');
  expect(out.ebook.options!.regions![0].style!.licenseConfirmed).toBe(false);expect(p).toEqual(before);
 });
 it('never transfers a body font redistribution acknowledgement to a different role font',()=>{
  const p=adoptPublicationStyle(plan(),{}),s=p.bookStyle!;s.ebookPermissions.body={licenseConfirmed:true};s.roles.letter={family:'Ink Free'};
  const out=publicationRenderPlan(p);expect(out.ebook.options!.specialText!.letter).toMatchObject({family:'Ink Free',licenseConfirmed:false});
  expect(out.ebook.options!.specialText!.poem!.licenseConfirmed).toBe(true);
 });
 it('does not implicitly adopt or alter a legacy plan on read',()=>{
  const p=plan();expect(publicationRenderPlan(p)).toBe(p);expect(p.bookStyle).toBeUndefined();
 });
});
describe('one shared appearance hierarchy',()=>{
 it('A and C follow First; B follows Second; one edit updates both without overrides',()=>{
  const s=inspectStyleMigration(plan()).style;s.roles.letter={italic:true};s.variants[first]={family:'Ink Free'};s.variants[second]={family:'Georgia'};
  const fonts=()=>[first,second,first].map(id=>resolveSharedAppearance(s,'letter',id).family);
  expect(fonts()).toEqual(['Ink Free','Georgia','Ink Free']);s.variants[first].family='Arial';expect(fonts()).toEqual(['Arial','Georgia','Arial']);
  expect(resolveSharedAppearance(s,'letter',first).italic).toBe(true);
 });
 it('passage override wins and reset restores named variant, then missing variant falls back',()=>{
  const s=inspectStyleMigration(plan()).style;s.roles.letter={family:'Georgia'};s.variants[first]={family:'Ink Free'};s.passages.A={family:'Arial'};
  expect(resolveSharedAppearance(s,'letter',first,'A').family).toBe('Arial');delete s.passages.A;
  expect(resolveSharedAppearance(s,'letter',first,'A').family).toBe('Ink Free');delete s.variants[first];
  expect(resolveSharedAppearance(s,'letter',first,'A').family).toBe('Georgia');
 });
 it('adapts shared relative dimensions to print without changing canonical intent',()=>{
  const s=inspectStyleMigration(plan()).style;s.roles.poem={family:'Georgia',size:1.5,insetStart:5,insetEnd:5,paragraphSpace:.8};
  const a=resolveSharedAppearance(s,'poem'),before=structuredClone(s),print=sharedPrintAppearance(a,12,300);
  expect(print).toMatchObject({font:'Georgia',sizePt:18,leftPt:15,rightPt:15,spacePt:14.4});expect(s).toEqual(before);
 });
 it('shared style round-trips JSON and remains project-local',()=>{
  const a=inspectStyleMigration(plan()).style,b=inspectStyleMigration(plan()).style;a.body.family='Ink Free';
  expect(JSON.parse(JSON.stringify(a))).toEqual(a);expect(b.body.family).toBe('Libertinus Serif');
 });
});
