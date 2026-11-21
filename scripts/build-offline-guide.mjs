import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import MarkdownIt from 'markdown-it';
import {sections} from '../docs/user-guide/tools/content.mjs';
const source=path.resolve('docs/user-guide'),out=path.resolve('dist-documentation');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
const pdf=await fs.readFile(path.join(source,'quick-start/output/PageHearth_Quick_Start_Guide_v0.1.2.pdf'));
if(sha(pdf)!=='D78F4AEF202C7250F09C9E57BD7EC195F61E6ABE7E8C56A75DD590E135A9EEB0')throw Error('Accepted PDF changed; review before packaging.');
await fs.mkdir(path.join(out,'user-guide/reference'),{recursive:true});
await fs.writeFile(path.join(out,'PageHearth_Quick_Start_Guide.pdf'),pdf);
const md=new MarkdownIt({html:false,linkify:false});
const rewrite=href=>href==='../README.md'?'../index.html':href==='../quick-start/output/PageHearth_Quick_Start_Guide_v0.1.2.pdf'?'../../PageHearth_Quick_Start_Guide.pdf':href.replace(/\.md(?=#|$)/,'.html');
md.renderer.rules.link_open=(tokens,i,options,env,self)=>{tokens[i].attrSet('href',rewrite(tokens[i].attrGet('href')||''));return self.renderToken(tokens,i,options);};
const escape=s=>md.utils.escapeHtml(s);
const names=[...sections.map(s=>s.id),'troubleshooting','keyboard'];
const titles=new Map([...sections.map(s=>[s.id,s.title]),['troubleshooting','Troubleshooting'],['keyboard','Keyboard reference']]);
const css=`:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#fffaf0;color:#302c29;font:17px/1.65 'Segoe UI',sans-serif}a{color:#8d4829;text-underline-offset:3px}a:focus-visible{outline:3px solid #8d4829;outline-offset:4px}.skip{position:absolute;left:-9999px}.skip:focus{left:12px;background:white;padding:8px}header{padding:24px max(24px,calc((100% - 940px)/2));border-bottom:1px solid #d6c6b3;background:#f3e6cf}header img{width:44px;height:44px;vertical-align:middle;margin-right:12px}header a{font:26px Georgia,serif;color:#302c29;text-decoration:none}main{max-width:940px;margin:auto;padding:32px 24px 60px}h1,h2,h3{font-family:Georgia,serif;line-height:1.25}h1{font-size:2.2rem}h2{margin-top:2em}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%;display:block;overflow:auto}td,th{padding:10px;border:1px solid #cbbda8;text-align:left}blockquote{margin:24px 0;padding:8px 20px;border-left:3px solid #a35d37;background:#f3e6cf}code{overflow-wrap:anywhere}nav ul{padding-left:24px}footer{border-top:1px solid #d6c6b3;padding:20px 0;margin-top:40px}@media print{header,.skip{display:none}body{background:white}main{max-width:none;padding:0}img{max-height:80vh;object-fit:contain}a{color:inherit}}`;
await fs.writeFile(path.join(out,'user-guide/guide.css'),css);
await fs.copyFile('assets/branding/pagehearth/PageHearth_Mark.svg',path.join(out,'user-guide/mark.svg'));
const html=(title,body,prefix='')=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="author" content="PageHearth"><title>${escape(title)} - PageHearth User Guide</title><link rel="stylesheet" href="${prefix}guide.css"></head><body><a class="skip" href="#content">Skip to content</a><header><a href="${prefix}index.html"><img src="${prefix}mark.svg" alt="">PageHearth User Guide</a></header><main id="content">${body}<footer><a href="${prefix}index.html">Guide contents</a> · <a href="${prefix}../PageHearth_Quick_Start_Guide.pdf">Quick Start PDF</a></footer></main></body></html>`;
const manifest={pdfSHA256:sha(pdf),chapters:[],assets:[]};
for(const name of names){const file='reference/'+name+'.md',bytes=await fs.readFile(path.join(source,file)),text=bytes.toString('utf8');await fs.writeFile(path.join(out,'user-guide/reference',name+'.html'),html(titles.get(name),md.render(text),'../'));manifest.chapters.push({source:file,sha256:sha(bytes),output:'user-guide/reference/'+name+'.html'});
 for(const [,url]of text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)){const relative=path.posix.normalize(path.posix.join('reference',url));if(!relative.startsWith('screenshots/'))throw Error('Unexpected asset '+url);if(manifest.assets.some(x=>x.file===relative))continue;const b=await fs.readFile(path.join(source,relative));await fs.mkdir(path.dirname(path.join(out,'user-guide',relative)),{recursive:true});await fs.writeFile(path.join(out,'user-guide',relative),b);manifest.assets.push({file:relative,sha256:sha(b)});}
}
await fs.writeFile(path.join(out,'user-guide/index.html'),html('Contents',`<h1>Write, organize and publish</h1><p>For PageHearth version 0.1.2 prerelease. These guides are installed on your computer and can be read without internet access.</p><p>Start with the <a href="../PageHearth_Quick_Start_Guide.pdf">Quick Start PDF</a>, or choose a topic.</p><nav aria-label="Guide chapters"><ul>${names.map(n=>`<li><a href="reference/${n}.html">${escape(titles.get(n))}</a></li>`).join('')}</ul></nav>`));
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(`Offline guide: ${names.length} complete chapters, ${manifest.assets.length} image assets; accepted PDF unchanged.`);
