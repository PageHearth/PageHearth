import {initialImportMapping,type ImportMapping,type ImportPreview,type ImportRequest} from './manuscriptImport.js';

export type ImportReviewState={token:string;revision:number;mapping:ImportMapping;status:'empty'|'pending'|'valid'|'invalid';preview:ImportPreview|null;error:string};
export const emptyImportReview=(revision=0):ImportReviewState=>({token:'',revision,mapping:initialImportMapping(),status:'empty',preview:null,error:''});
export function updateImportMapping(current:ImportMapping,patch:Partial<ImportMapping>):ImportMapping{
 const next={...current,...patch};
 if(patch.chapter!==undefined||patch.scene!==undefined){next.excluded=[];next.titles={};}
 if(next.chapter==='single'||next.chapter===next.scene||(/^h\d$/.test(next.chapter)&&/^h\d$/.test(next.scene)&&Number(next.scene.slice(1))<=Number(next.chapter.slice(1))))next.scene='none';
 return next;
}
export function beginImportReview(state:ImportReviewState,token:string,mapping:ImportMapping):ImportReviewState{return {token,revision:state.revision+1,mapping,status:'pending',preview:state.token===token?state.preview:null,error:''};}
export function settleImportReview(state:ImportReviewState,owner:{token:string;revision:number},result:{preview:ImportPreview}|{error:string}):ImportReviewState{
 if(state.token!==owner.token||state.revision!==owner.revision)return state;
 return 'preview'in result?{...state,status:'valid',preview:result.preview,error:''}:{...state,status:'invalid',error:result.error};
}
export function importReviewReady(state:ImportReviewState){return state.status==='valid'&&state.preview?.token===state.token&&state.preview.chapters>0&&!state.preview.diagnostics.some(d=>d.severity==='BLOCKING');}
/** Optional members must be absent, not undefined: Electron preserves undefined. */
export function importPreviewRequest(token:string,mapping:ImportMapping,page=0,sample?:string):ImportRequest{return {kind:'preview',token,mapping,page,...(sample===undefined?{}:{sample})};}
