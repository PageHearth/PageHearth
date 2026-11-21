import {describe,it,expect} from 'vitest';
import {defaultPublication,validatePublication,editPublication} from '../src/shared/publication';
import {readCovers,coverGeometry,panelPlacement,defaultPanel,ebookCover,coverIdentity} from '../src/shared/covers';
import {compilePublication} from '../src/shared/publicationCompiler';
import {printFingerprint} from '../src/main/typstPrint';
import {defaultAuthor,type Project} from '../src/shared/model';
import {randomUUID} from 'node:crypto';
const plan=()=>{const p=defaultPublication('Book');p.print.profile='kdp';return p;};
const fixture=():Project=>{const id=randomUUID();return {manifest:{version:1,id:randomUUID(),title:'Cover test',revision:0,nodes:[{id,title:'Chapter',kind:'Chapter',parent:null}],settings:{editor:{},publication:{},workspace:{}}},documents:{[id]:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Unchanged manuscript.'}]}]}},author:defaultAuthor(),recovery:[]};};
describe('Cover production foundation',()=>{
 it('projects legacy artwork without writing or losing it',()=>{const p=plan();p.metadata.coverAsset='assets/old.png';const before=JSON.stringify(p);expect(readCovers(p).front.asset).toBe('assets/old.png');expect(ebookCover(p)).toBe('assets/old.png');expect(JSON.stringify(p)).toBe(before);});
 it('uses the exact KDP white-paper equation and bleed',()=>{const g=coverGeometry(plan(),312);expect(g.spine/72).toBeCloseTo(.702624,10);expect(g.width/72).toBeCloseTo(12.952624,10);expect(g.height/72).toBe(9.25);expect(g.bleed).toBe(9);expect(g.spineSafe).toBe(4.5);expect(g.barcode).toEqual({x:279,y:552.6,width:144,height:86.4});});
 it('rounds odd physical page count without estimating prose',()=>{expect(coverGeometry(plan(),311)).toEqual(coverGeometry(plan(),312));});
 it.each([[78,false],[79,true],[80,true]])('uses current uploaded-PDF spine eligibility %s',(pages,expected)=>expect(coverGeometry(plan(),Number(pages)).spineText).toBe(expected));
 it('recalculates trim and page count',()=>{const p=plan(),a=coverGeometry(p,312);p.print.width=360;p.print.height=576;const b=coverGeometry(p,348);expect(b.width/72).toBeCloseTo(11.033696,10);expect(b.height/72).toBe(8.25);expect(b.spine).toBeGreaterThan(a.spine);});
 it.each(['generic','ingram','custom'] as const)('does not falsely qualify %s',profile=>{const p=plan();p.print.profile=profile;expect(()=>coverGeometry(p,312)).toThrow('not qualified');});
 it.each([0,23,829,NaN,24.5])('rejects invalid page count %s',pages=>expect(()=>coverGeometry(plan(),pages)).toThrow());
 it('calculates effective PPI not metadata',()=>{const a=panelPlacement(defaultPanel(),{width:1800,height:2700},432,648);expect(a.ppi).toBe(300);expect(a.crop).toBe(0);expect(a.targetWidth).toBe(1800);expect(panelPlacement(defaultPanel(),{width:900,height:1350},432,648).ppi).toBe(150);expect(panelPlacement(defaultPanel(),{width:3600,height:5400},432,648).ppi).toBe(600);});
 it('Fill crops; Fit contains; zoom reduces effective resolution',()=>{const size={width:1800,height:1800};const fill=panelPlacement(defaultPanel(),size,432,648),fit=panelPlacement({...defaultPanel(),fit:'fit'},size,432,648),zoom=panelPlacement({...defaultPanel(),scale:2},size,432,648);expect(fill.crop).toBeCloseTo(100/3);expect(fit.crop).toBe(0);expect(fit.height).toBe(432);expect(zoom.ppi).toBe(fill.ppi/2);});
 it('keeps mode configurations and separate ebook choice',()=>{const p=plan();p.covers=readCovers(p);p.covers.front.asset='assets/front.png';p.covers.wrapAsset='assets/wrap.pdf';p.covers.ebookAsset='assets/ebook.jpg';p.covers.mode='pdf';expect(ebookCover(p)).toBe('assets/front.png');p.covers.separateEbook=true;expect(ebookCover(p)).toBe('assets/ebook.jpg');validatePublication(p);expect(JSON.parse(JSON.stringify(p)).covers.front.asset).toBe('assets/front.png');});
 it('rejects unsafe paths and future cover schema',()=>{const p=plan();p.covers=readCovers(p);p.covers.front.asset='C:/bad.jpg';expect(()=>validatePublication(p)).toThrow();delete p.covers.front.asset;(p.covers as any).version=2;expect(()=>validatePublication(p)).toThrow();});
 it('cover changes affect ebook but never interior or manuscript identity',()=>{const p=fixture(),before=JSON.stringify(p),key=printFingerprint(p),next=editPublication(p,plan=>{plan.covers=readCovers(plan);plan.covers.front.asset='assets/front.png';});expect(printFingerprint(next)).toBe(key);const snapshot=JSON.stringify(next);expect(compilePublication(next,'ebook').metadata.coverAsset).toBe('assets/front.png');expect(JSON.stringify(next)).toBe(snapshot);expect(next.documents).toEqual(p.documents);expect(JSON.stringify(p)).toBe(before);});
 it('removal does not resurrect legacy artwork; last receipt does not invalidate current cover',()=>{const p=plan();p.metadata.coverAsset='assets/old.png';p.covers=readCovers(p);delete p.covers.front.asset;expect(ebookCover(p)).toBeUndefined();const key=coverIdentity(p,'a');p.covers.last={interior:'a'.repeat(64),pages:312,spine:50,width:900,height:666};expect(coverIdentity(p,'a')).toBe(key);});
});
it('preserves the accepted 60K QA cover geometry',()=>{const g=coverGeometry(plan(),143);expect(g.pages).toBe(144);expect(g.spine/72).toBeCloseTo(.324288,10);expect(g.width/72).toBeCloseTo(12.574288,10);expect(g.height/72).toBe(9.25);});


describe('normalized X/Y travel',()=>{
 it.each(['fill','fit'] as const)('exact-ratio %s has no travel until scaled',fit=>{
  const p={...defaultPanel(),fit},size={width:2450,height:3700};
  for(const x of [0,.5,1])for(const y of [0,.5,1]){const a=panelPlacement({...p,x,y},size,441,666);expect(a.x).toBe(0);expect(a.y).toBe(0);expect(a.movableX||a.movableY).toBe(false);}
  for(const x of [0,.5,1])for(const y of [0,.5,1]){const a=panelPlacement({...p,scale:1.3,x,y},size,441,666);expect(a.x).toBeCloseTo(-132.3*x);expect(a.y).toBeCloseTo(-199.8*y);expect(a.movableX&&a.movableY).toBe(true);}
 });
 it.each(['fill','fit'] as const)('%s exposes only axes with actual crop or spare-space travel',fit=>{
  const a=panelPlacement({...defaultPanel(),fit,x:1,y:1},{width:2000,height:1600},441,666);
  expect(a.movableX).toBe(fit==='fill');expect(a.movableY).toBe(fit==='fit');
  if(fit==='fit'){expect(a.y).toBeGreaterThan(0);expect(a.x).toBe(0);}else{expect(a.x).toBeLessThan(0);expect(a.y).toBe(0);}
 });
});
