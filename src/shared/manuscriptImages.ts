import type {Doc} from './model.js';

export const imageSizes=['small','medium','large','full-width'] as const;
export const imageAlignments=['left','center','right'] as const;
export type ManuscriptImage={sourceAsset?:string|null;id:string;projectId:string;asset:string;alt:string;caption:string;size:typeof imageSizes[number];alignment:typeof imageAlignments[number];decorative:boolean;width:number;height:number};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
export const manuscriptImageAsset=(v:unknown):v is string=>typeof v==='string'&&/^assets\/manuscript\/[a-f0-9]{64}\.(png|jpg)$/.test(v);
/** Asset paths and dimensions are validated independently of display/import state. */
export function validManuscriptImage(value:unknown):value is ManuscriptImage{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const a=value as ManuscriptImage;
 return (a.sourceAsset==null||manuscriptImageAsset(a.sourceAsset))&&uuid(a.id)&&uuid(a.projectId)&&manuscriptImageAsset(a.asset)&&typeof a.alt==='string'&&a.alt.length<=10000&&typeof a.caption==='string'&&a.caption.length<=10000&&imageSizes.includes(a.size)&&imageAlignments.includes(a.alignment)&&typeof a.decorative==='boolean'&&Number.isInteger(a.width)&&a.width>0&&Number.isInteger(a.height)&&a.height>0&&a.width*a.height<=32_000_000&&Object.keys(a).every(k=>['sourceAsset','id','projectId','asset','alt','caption','size','alignment','decorative','width','height'].includes(k));
}
export function createManuscriptImage(projectId:string,asset:string,width:number,height:number,id=crypto.randomUUID()):Doc{
 const attrs:ManuscriptImage={id,projectId,asset,width,height,alt:'',caption:'',size:'medium',alignment:'center',decorative:false};
 if(!validManuscriptImage(attrs))throw Error('Invalid manuscript image.');
 return {type:'manuscriptImage',attrs};
}
export function validateManuscriptImageBlocks(doc:Doc,projectId:string){
 const ids=new Set<string>();const visit=(n:Doc,depth:number)=>{if(n.type==='manuscriptImage'){if(depth!==1||!validManuscriptImage(n.attrs)||n.attrs.projectId!==projectId||n.content?.length||n.marks?.length||n.text!==undefined||ids.has(n.attrs.id))throw Error('Images must be separate blocks in their own project manuscript.');ids.add(n.attrs.id);}n.content?.forEach(c=>visit(c,depth+1));};visit(doc,0);
}
export const imageWidthFraction=(size:ManuscriptImage['size'])=>({small:.3,medium:.6,large:.85,'full-width':1})[size];
/** Points, preserving aspect ratio, bounded by width, height and source at 96 PPI. */
export function manuscriptImagePlacement(a:Pick<ManuscriptImage,'size'|'width'|'height'>,availableWidth:number,availableHeight=Infinity){
 const width=Math.max(0,Math.min(availableWidth*imageWidthFraction(a.size),a.width*72/96,availableHeight*a.width/a.height));
 const height=width*a.height/a.width;
 return {width,height,ppi:width?a.width/(width/72):0};
}
