import {diffWordsWithSpace,type Change} from 'diff';
/** Bounded Myers comparison; pathological replacements retain a readable coarse diff. */
export function compareText(before:string,after:string):{changes:Change[];coarse:boolean}{const changes=diffWordsWithSpace(before,after,{timeout:150,maxEditLength:4000});return changes?{changes,coarse:false}:{changes:[{value:before,removed:true,added:false,count:1},{value:after,removed:false,added:true,count:1}],coarse:true};}
