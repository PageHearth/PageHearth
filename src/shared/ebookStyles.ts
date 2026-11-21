import type {SpecialTextRole} from './specialText.js';
import {validSpecialText} from './specialText.js';
import {validFontFamily} from './fonts.js';
export type EbookRoleStyle={fontPolicy?:'body'|'reader'|'embedded';family?:string;licenseConfirmed?:boolean;size?:number;alignment?:'start'|'center'|'end'|'justify';insetStart?:number;insetEnd?:number;paragraphSpace?:number;indent?:number;lineHeight?:number;italic?:boolean};
export type EbookRoleStyles=Partial<Record<SpecialTextRole,EbookRoleStyle>>;
export function validateEbookRoleStyle(value:unknown):asserts value is EbookRoleStyle{
 const s=value as EbookRoleStyle;if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).some(k=>!['fontPolicy','family','licenseConfirmed','size','alignment','insetStart','insetEnd','paragraphSpace','indent','lineHeight','italic'].includes(k)))throw Error('Invalid eBook Special Text style.');
 if(s.fontPolicy!==undefined&&!['body','reader','embedded'].includes(s.fontPolicy)||s.family!==undefined&&!validFontFamily(s.family)||s.alignment!==undefined&&!['start','center','end','justify'].includes(s.alignment)||s.italic!==undefined&&typeof s.italic!=='boolean'||s.licenseConfirmed!==undefined&&typeof s.licenseConfirmed!=='boolean')throw Error('Invalid eBook Special Text treatment.');
 for(const [key,min,max] of [['size',.5,2],['insetStart',0,15],['insetEnd',0,15],['paragraphSpace',0,3],['indent',0,8],['lineHeight',1,2.5]] as const){const n=s[key];if(n!==undefined&&(!Number.isFinite(n)||n<min||n>max))throw Error('Invalid eBook Special Text dimensions.');}
}
export function validateEbookRoleStyles(v:unknown):asserts v is EbookRoleStyles{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid eBook role styles.');for(const [role,s] of Object.entries(v)){if(!validSpecialText(role))throw Error('Invalid eBook role.');validateEbookRoleStyle(s);}}
export function ebookRoleStyle(role:SpecialTextRole,styles?:EbookRoleStyles):EbookRoleStyle{return {fontPolicy:'body',alignment:'start',insetStart:role==='custom'?0:5,insetEnd:role==='custom'?0:5,paragraphSpace:role==='poem'?1:.5,italic:['letter','journal','written-note'].includes(role),...styles?.[role]};}
