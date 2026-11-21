type TextItem={str:string;transform:number[];width:number;height?:number};
/** Detect sustained spatial gutters independent of content-stream order.
 * This is a confidence signal, never a request to rearrange extracted prose.
 * One centered title, an indent, or a sparse pair of labels is insufficient.
 */
export function hasColumnAmbiguity(items:TextItem[]):boolean{
 const rows:{y:number;spans:{left:number;right:number;height:number}[]}[]=[];
 for(const item of [...items].sort((a,b)=>b.transform[5]-a.transform[5])){
  const [left,y]=item.transform.slice(4),right=left+item.width;
  if(!item.str.trim()||![left,y,right].every(Number.isFinite)||right<=left)continue;
  let row=rows.at(-1);if(!row||Math.abs(row.y-y)>2){row={y,spans:[]};rows.push(row);}
  row.spans.push({left,right,height:Math.abs(item.height||item.transform[3]||10)});
 }
 const gutters:{left:number;right:number;ys:number[]}[]=[];
 for(const row of rows){
  const spans=row.spans.sort((a,b)=>a.left-b.left);let end=spans[0].right;
  for(let i=1;i<spans.length;i++){
   const span=spans[i],gap=span.left-end;
   if(gap>=Math.max(24,span.height*2)){
    const gutter=gutters.find(g=>Math.min(g.right,span.left)-Math.max(g.left,end)>=16);
    if(gutter){gutter.left=Math.max(gutter.left,end);gutter.right=Math.min(gutter.right,span.left);if(!gutter.ys.includes(row.y))gutter.ys.push(row.y);if(gutter.ys.length>=3&&Math.max(...gutter.ys)-Math.min(...gutter.ys)>=span.height*2)return true;}
    else gutters.push({left:end,right:span.left,ys:[row.y]});
   }
   end=Math.max(end,span.right);
  }
 }
 return false;
}
