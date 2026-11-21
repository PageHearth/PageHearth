import type {DeepReadonly,PreflightIssue} from './publicationCompiler.js';
/** Presentation extracts only names supplied by existing renderer diagnostics. */
export function epubFallbackFonts(issues:readonly DeepReadonly<PreflightIssue>[]){
 const fonts=new Map<string,{name:string;messages:string[];chapter:boolean}>();
 for(const issue of issues){if(issue.code!=='font-unavailable'||issue.blocking||issue.severity!=='warning')continue;
 const chapter=issue.message.startsWith('Chapter font '),name=issue.message.replace(/^Chapter font /,'').split(/:| cannot be embedded/)[0].trim()||'Selected font';
 const entry=fonts.get(name)??{name,messages:[],chapter:false};entry.chapter ||= chapter;if(!entry.messages.includes(issue.message))entry.messages.push(issue.message);fonts.set(name,entry);
 }return [...fonts.values()];
}
