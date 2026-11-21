import type {DeepReadonly,PreflightIssue} from './publicationCompiler.js';
/** Presentation only. Raw diagnostics remain authoritative and are never removed. */
export function groupedPublicationIssues(issues:readonly DeepReadonly<PreflightIssue>[]){
 const groups=new Map<string,{issue:DeepReadonly<PreflightIssue>;count:number}>();
 for(const issue of issues){const key=JSON.stringify([issue.severity,issue.blocking,issue.code,issue.message,issue.fix]);const prior=groups.get(key);if(prior)prior.count++;else groups.set(key,{issue,count:1});}
 return [...groups.values()];
}
