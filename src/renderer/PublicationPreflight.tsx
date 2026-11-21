import {epubFallbackFonts} from '../shared/epubFallbackFonts';
import React from 'react';
import type {DeepReadonly,PreflightIssue} from '../shared/publicationCompiler';
import {groupedPublicationIssues} from '../shared/publicationPreflight';
export default function PublicationPreflight({issues,readyLabel='Ready to export'}:{issues:readonly DeepReadonly<PreflightIssue>[];readyLabel?:string}){
 const grouped=groupedPublicationIssues(issues),errors=grouped.filter(g=>g.issue.blocking),warnings=grouped.filter(g=>g.issue.severity==='warning'&&!g.issue.blocking);
 const fonts=warnings.filter(g=>g.issue.code==='font-unavailable'),other=warnings.filter(g=>g.issue.code!=='font-unavailable');
 const families=epubFallbackFonts(issues);
 const row=({issue,count}:typeof grouped[number],i:number)=><li key={i}>{issue.message}{count>1&&<small> · {count} occurrences</small>}<small>{issue.fix}</small></li>;
 return <><p className={'preflight-summary '+(errors.length?'needs-attention':warnings.length?'has-warnings':'checks-clear')} role="status">{errors.length?'Needs attention':readyLabel} · {errors.length} errors · {warnings.length} warnings</p>
 {errors.length>0&&<div className="preflight-blocking" role="alert"><strong>Blocking issues</strong><ul>{errors.map(row)}</ul></div>}
 {warnings.length>0&&<details className="publication-warnings"><summary>Warnings ({warnings.length})</summary>{fonts.length>0&&<details><summary>{families.length} {families.length===1?'font cannot':'fonts cannot'} be embedded in EPUB</summary><p>The eBook reader will use a fallback. Its exact appearance depends on the reader and available fonts.</p><ul>{families.map(f=><li key={f.name}><strong>{f.name}</strong>{f.chapter&&<small>Used by: chapter headings</small>}<small>Fallback: reader or body font, according to the affected style.</small></li>)}</ul></details>}<ul>{other.map(row)}</ul></details>}
 <details className="preflight-technical"><summary>Technical details</summary><ul>{issues.map((issue,i)=><li key={i}>{issue.severity} · {issue.code} · {issue.message} {issue.fix} {issue.source?.id}</li>)}</ul></details></>;
}
