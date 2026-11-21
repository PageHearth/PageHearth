import type {PublicationPlan} from './publication.js';
import {safeAsset} from './publication.js';
import {trimSizes,kdpMaxPages} from './printProduction.js';
export type CoverPanel={asset?:string;fit:'fill'|'fit';scale:number;x:number;y:number};
export type CoverConfig={version:1;mode:'assembly'|'pdf';front:CoverPanel;back:CoverPanel;separateEbook:boolean;ebookAsset?:string;wrapAsset?:string;backColor:string;spineColor:string;spine:{title?:string;author?:string;hideTitle:boolean;hideAuthor:boolean;font:string;size:number;bold:boolean;color:string};last?:{interior:string;pages:number;spine:number;width:number;height:number}};
export type CoverGeometry={width:number;height:number;trimWidth:number;trimHeight:number;spine:number;bleed:number;safe:number;spineSafe:number;pages:number;spineText:boolean;frontX:number;barcode:{x:number;y:number;width:number;height:number}};
/** Official KDP cover/barcode rules reviewed 2026-11-04. Only existing black ink / white paper profile. Points throughout. */
export const coverProfile={id:'kdp',name:'KDP Paperback · Black ink / white paper',qualification:'qualified implemented rules',binding:'paperback',bleed:9,safe:9,spineSafe:4.5,pageInches:.002252,spineTextMinimum:79,ppi:300,barcode:{width:144,height:86.4,clearance:18},sources:['https://kdp.amazon.com/en_US/help/topic/G201953020','https://kdp.amazon.com/en_US/help/topic/G5HDYGP4BXLX4RUW']} as const;
export const defaultPanel=():CoverPanel=>({fit:'fill',scale:1,x:.5,y:.5});
export function readCovers(p:PublicationPlan):CoverConfig{return p.covers??{version:1,mode:'assembly',front:{...defaultPanel(),asset:p.metadata.coverAsset},back:defaultPanel(),separateEbook:false,backColor:'#ffffff',spineColor:'#ffffff',spine:{hideTitle:false,hideAuthor:false,font:'Libertinus Serif',size:10,bold:false,color:'#000000'}};}
export function ebookCover(p:PublicationPlan){const c=readCovers(p);return c.separateEbook?c.ebookAsset:c.front.asset;}
export function validateCovers(c:CoverConfig){const fail=()=>{throw Error('Unsupported or damaged cover configuration.');};if(!c||c.version!==1||!['assembly','pdf'].includes(c.mode)||typeof c.separateEbook!=='boolean')fail();for(const panel of [c.front,c.back])if(!panel||!['fill','fit'].includes(panel.fit)||![panel.scale,panel.x,panel.y].every(Number.isFinite)||panel.scale<1||panel.scale>4||panel.x<0||panel.x>1||panel.y<0||panel.y>1)fail();for(const a of [c.front.asset,c.back.asset,c.ebookAsset,c.wrapAsset])if(a!==undefined&&!safeAsset(a))fail();for(const color of [c.backColor,c.spineColor,c.spine?.color])if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))fail();const s=c.spine;if(!s||typeof s.font!=='string'||s.font.length>200||!s.font||!Number.isFinite(s.size)||s.size<6||s.size>36||[s.bold,s.hideTitle,s.hideAuthor].some(v=>typeof v!=='boolean')||[s.title,s.author].some(v=>v!==undefined&&(typeof v!=='string'||v.length>1000)))fail();if(c.last&&(!/^[a-f0-9]{64}$/.test(c.last.interior)||![c.last.pages,c.last.spine,c.last.width,c.last.height].every(v=>Number.isFinite(v)&&v>0)))fail();}
export function coverGeometry(p:PublicationPlan,pages:number):CoverGeometry{
 const {width:w,height:h}=p.print,r=coverProfile;if(p.print.profile!=='kdp')throw Error('Choose KDP black ink / white paper in Print settings. Other cover profiles are not qualified.');if(!trimSizes.some(([a,b])=>a*72===w&&b*72===h))throw Error('Unsupported KDP trim size.');if(!Number.isInteger(pages)||pages<24||pages>kdpMaxPages(w,h))throw Error('Final page count is outside this KDP print profile.');
 // KDP rounds an odd interior up to an even physical page count.
 const physical=pages+pages%2,spine=physical*r.pageInches*72,width=w*2+spine+r.bleed*2,height=h+r.bleed*2;
 return {width,height,trimWidth:w,trimHeight:h,spine,bleed:r.bleed,safe:r.safe,spineSafe:r.spineSafe,pages:physical,spineText:pages>=r.spineTextMinimum,frontX:r.bleed+w+spine,barcode:{x:r.bleed+w-r.barcode.clearance-r.barcode.width,y:r.bleed+h-r.barcode.clearance-r.barcode.height,width:r.barcode.width,height:r.barcode.height}};
}
export function panelPlacement(p:CoverPanel,pixels:{width:number;height:number},width:number,height:number){
 if(!pixels.width||!pixels.height)throw Error('Image dimensions are missing.');const factor=(p.fit==='fill'?Math.max(width/pixels.width,height/pixels.height):Math.min(width/pixels.width,height/pixels.height))*p.scale;const w=pixels.width*factor,h=pixels.height*factor;
 // Normalized alignment: crop excess in Fill; position within spare space in Fit.
 // An exactly fitted axis has no travel, irrespective of the saved alignment.
 return {movableX:Math.abs(width-w)>0.01,movableY:Math.abs(height-h)>0.01,width:w,height:h,x:(width-w)*p.x,y:(height-h)*p.y,ppi:72/factor,crop:100*(1-Math.min(1,width/w)*Math.min(1,height/h)),targetWidth:Math.ceil(width/72*300),targetHeight:Math.ceil(height/72*300)};
}
export type CoverAssetInfo={asset:string;width:number;height:number;format:string;dataUrl?:string;pages?:number;color:string};
export type CoverResult={id:string;fingerprint:string;interior:string;geometry:CoverGeometry;previewSize?:{width:number;height:number};blocking:string[];pdf:Uint8Array;issues:string[];sha256:string};

export function coverIdentity(plan:PublicationPlan,interior:string){const c=structuredClone(readCovers(plan));delete c.last;return JSON.stringify({c,title:plan.metadata.title,author:plan.metadata.author,interior});}

export type CoverChoice={token:string;info:CoverAssetInfo}|{error:{message:string}}|null;
