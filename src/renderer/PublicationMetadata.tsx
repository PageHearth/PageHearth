import React from 'react';
import type {PublicationPlan} from '../shared/publication';
export default function PublicationMetadata({plan,update,onCovers}:{plan:PublicationPlan;update:(edit:(p:PublicationPlan)=>void)=>void;onCovers:()=>void}){
 const fields=(entries:readonly (readonly [keyof Pick<PublicationPlan['metadata'],'title'|'subtitle'|'author'|'language'|'series'|'seriesPosition'|'publisher'|'copyrightHolder'|'copyrightYear'|'publicationDate'>,string])[])=>entries.map(([key,label])=><label key={key}>{label}<input value={plan.metadata[key]} onChange={e=>update(p=>{p.metadata[key]=e.target.value;})}/>{key==='publisher'&&<small>The publisher name shown in this edition.</small>}</label>);
 return <details className="publication-metadata"><summary>Book Metadata</summary><p>The information shown in this edition.</p>
 <fieldset><legend>Book identity</legend>{fields([['title','Book title'],['subtitle','Subtitle'],['series','Series'],['seriesPosition','Series position']])}</fieldset>
 <fieldset><legend>Author & publisher</legend>{fields([['author','Primary author'],['publisher','Publisher / imprint']])}<label>Contributors (one per line)<textarea value={plan.metadata.contributors.join('\n')} onChange={e=>update(p=>{p.metadata.contributors=e.target.value.split('\n');})}/></label></fieldset>
 <fieldset><legend>Language & edition</legend>{fields([['language','Language'],['publicationDate','Publication date'],['copyrightHolder','Copyright holder'],['copyrightYear','Copyright year']])}</fieldset>
 <details><summary>Edition identifiers</summary><p>Optional identifiers for each edition.</p>{(['ebook','paperback','hardcover'] as const).map(edition=><label key={edition}>{edition==='ebook'?'eBook identifier / ISBN':edition==='paperback'?'Paperback ISBN':'Hardcover ISBN'}<input value={plan.metadata.identifiers[edition]} onChange={e=>update(p=>{p.metadata.identifiers[edition]=e.target.value;})}/></label>)}</details>
 <button onClick={onCovers}>Choose artwork in Covers…</button><small>Front Cover also supplies the eBook cover by default.</small></details>;
}
