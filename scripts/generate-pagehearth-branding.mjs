// Derived assets from Hush's approved, manually constructed SVG. No tracing or image generation.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const dir=path.resolve('assets/branding/pagehearth');
const mark=await fs.readFile(path.join(dir,'PageHearth_Mark.svg'),'utf8');
const geometry=mark.slice(mark.indexOf('  <!--'),mark.lastIndexOf('</svg>'));
const wordmark=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1268 290" role="img" aria-label="PageHearth"><defs><linearGradient id="page" x2="1" y2="0"><stop stop-color="#24BBD0"/><stop offset="1" stop-color="#D9BBE4"/></linearGradient><linearGradient id="hearth" x2="1" y2="0"><stop stop-color="#F4BC73"/><stop offset="1" stop-color="#E98538"/></linearGradient></defs><g transform="translate(8 17)">${geometry}</g><g font-family="Georgia,serif" font-size="168" letter-spacing="-7" stroke="#352B27" stroke-width="2" paint-order="stroke fill"><text x="278" y="205" fill="url(#page)">Page</text><text x="630" y="205" fill="url(#hearth)">Hearth</text></g></svg>`;
await fs.writeFile(path.join(dir,'PageHearth_Wordmark.svg'),wordmark);
const file=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M40 8H164L224 68V246H40Z" fill="#FFF0CF" stroke="#352B27" stroke-width="10" stroke-linejoin="round"/><path d="M164 8V68H224" fill="#F4DBAA" stroke="#352B27" stroke-width="10" stroke-linejoin="round"/><g transform="translate(53 80) scale(.61)">${geometry}</g></svg>`;
await fs.writeFile(path.join(dir,'PageHearth_File_Mark.svg'),file);
const hero=`<svg xmlns="http://www.w3.org/2000/svg" width="1672" height="941" viewBox="0 0 1672 941"><rect width="1672" height="941" fill="#F3E4CD"/><path d="M0 780L1672 390V941H0Z" fill="#B96538"/><path d="M0 940L1672 640V941H0Z" fill="#352B27"/><svg x="150" y="130" width="1372" height="314" viewBox="0 0 1268 290">${wordmark.slice(wordmark.indexOf('<defs>'),wordmark.lastIndexOf('</svg>'))}</svg></svg>`;
await fs.writeFile(path.join(dir,'PageHearth_Hero.svg'),hero);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage({deviceScaleFactor:1});
async function png(svg,w,h){await page.setViewportSize({width:w,height:h});await page.setContent(`<style>html,body{margin:0;background:transparent;width:100%;height:100%}svg{width:100%;height:100%;display:block}</style>${svg}`);await page.evaluate(()=>document.fonts.ready);return page.screenshot({omitBackground:true});}
for(const [name,svg,w,h] of [['PageHearth_App_Icon.png',mark,1024,1024],['PageHearth_Wordmark_Nav.png',wordmark,1268,290],['PageHearth_Wordmark.png',wordmark,1268,290],['PageHearth_Wordmark_Glow_Alpha.png',wordmark,1268,290],['PageHearth_Hero_Wordmark.png',hero,1672,941]])await fs.writeFile(path.join(dir,name),await png(svg,w,h));
async function ico(svg){const sizes=[16,24,32,48,64,128,256],images=[];for(const size of sizes)images.push(await png(svg,size,size));const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;images.forEach((b,i)=>{const at=6+i*16;header[at]=sizes[i]%256;header[at+1]=sizes[i]%256;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(b.length,at+8);header.writeUInt32LE(offset,at+12);offset+=b.length;});return Buffer.concat([header,...images]);}
const app=await ico(mark);await fs.writeFile(path.join(dir,'PageHearth_App_Icon.ico'),app);await fs.writeFile(path.join(dir,'PageHearth_Install_Icon.ico'),app);await fs.writeFile(path.join(dir,'PageHearth_File_Icon.ico'),await ico(file));
}finally{await browser.close();}
console.log('Generated production PNG/ICO assets from approved vector geometry and local Georgia typography.');
