import type {EbookRegionOverride} from './ebookRegions.js';
import {validateEbookRoleStyle} from './ebookStyles.js';
import {validateSpecialTextStyles,validSpecialRegionId,validSpecialText} from './specialText.js';
import {validateEbookRoleStyles,type EbookRoleStyles} from './ebookStyles.js';
import type {PreflightIssue} from './publicationCompiler.js';

export type EbookOptions={profile:'generic'|'kindle'|'apple'|'kobo'|'google'|'ingram';font:'reader-default'|'serif'|'sans-serif';paragraphs:'indented'|'spaced';sceneBoundary?:'none'|'space'|'ornament';specialText?:EbookRoleStyles;chapterStyle?:import('./ebookStyles.js').EbookRoleStyle;regions?:EbookRegionOverride[];embeddedFont?:{family:string;licenseConfirmed:boolean}};
export const defaultEbookOptions:Readonly<EbookOptions>={profile:'generic',font:'reader-default',paragraphs:'indented'};
export function validateEbookOptions(value:unknown):asserts value is EbookOptions{
 const v=value as EbookOptions;if(!v||!['generic','kindle','apple','kobo','google','ingram'].includes(v.profile)||!['reader-default','serif','sans-serif'].includes(v.font)||!['indented','spaced'].includes(v.paragraphs))throw Error('Unsupported eBook settings.');
 if(v.regions!==undefined){if(!Array.isArray(v.regions)||v.regions.length>2048)throw Error('Invalid region styles.');for(const r of v.regions){if(!r||typeof r.sourceId!=='string'||r.sourceId.length>200||!['manuscript','publication'].includes(r.sourceKind)||!validSpecialRegionId(r.regionId)||!validSpecialText(r.role))throw Error('Invalid region style identity.');if(r.variantId!==undefined&&!validSpecialRegionId(r.variantId))throw Error('Invalid variant reference.');if(r.style!==undefined)validateEbookRoleStyle(r.style);if(r.printStyle!==undefined)validateSpecialTextStyles({[r.role]:r.printStyle});}}
 if(v.chapterStyle!==undefined)validateEbookRoleStyle(v.chapterStyle);
 if(v.specialText!==undefined)validateEbookRoleStyles(v.specialText);
 if(v.sceneBoundary!==undefined&&!['none','space','ornament'].includes(v.sceneBoundary))throw Error('Invalid eBook scene boundary.');
 if(v.embeddedFont&&(typeof v.embeddedFont.family!=='string'||v.embeddedFont.family.length>200||typeof v.embeddedFont.licenseConfirmed!=='boolean'))throw Error('Invalid eBook font settings.');
}
export type EbookValidation={version:string;status:'pass'|'fail'|'unavailable';messages:{severity:string;code:string;message:string}[]};
export type EbookProof={projectId:string;artifactPath:string;bytes:number;sha256:string;sections:{id:string;title:string;href:string;xhtml:string;sourceIds:string[]}[];css:string;images:Record<string,string>;issues:PreflightIssue[];validation:EbookValidation[];timings:Record<string,number>};

/** Display resources only. Never accepted as a validated export artifact. */
export type EbookPreviewResult=Pick<EbookProof,'projectId'|'sections'|'css'|'images'|'issues'|'timings'>&{mode:'preview'};
