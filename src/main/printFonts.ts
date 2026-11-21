import {promises as fs} from 'node:fs';
import path from 'node:path';
export type PrintFont={family:string;file:string;fsType:number};
/** Read only the SFNT name and OS/2 tables; tolerate damaged installed fonts. */
export function fontRecords(b:Buffer,file:string):PrintFont[]{
 const result:PrintFont[]=[];
 try{const offsets=b.toString('ascii',0,4)==='ttcf'?Array.from({length:Math.min(256,b.readUInt32BE(8))},(_,i)=>b.readUInt32BE(12+i*4)):[0];
 for(const base of offsets){let name=0,os=0;for(let i=0;i<b.readUInt16BE(base+4);i++){const a=base+12+i*16,tag=b.toString('ascii',a,a+4),off=b.readUInt32BE(a+8);if(tag==='name')name=off;if(tag==='OS/2')os=off;}
 if(!name||!os)continue;const names=new Set<string>();for(let i=0;i<b.readUInt16BE(name+2);i++){const a=name+6+i*12,id=b.readUInt16BE(a+6);if(![1,16].includes(id))continue;const platform=b.readUInt16BE(a),len=b.readUInt16BE(a+8),off=name+b.readUInt16BE(name+4)+b.readUInt16BE(a+10);let text='';if(platform===0||platform===3){for(let j=0;j<len;j+=2)text+=String.fromCharCode(b.readUInt16BE(off+j));}else if(platform===1)text=b.toString('latin1',off,off+len);if(text)names.add(text);}
 for(const family of names)result.push({family,file,fsType:b.readUInt16BE(os+8)});
 }}catch{/* A damaged font is unavailable, never assumed embeddable. */}return result;
}
export const embeddingAllowed=(bits:number)=>!(bits&0x102)&&!(bits&0x200);
let cache:Promise<PrintFont[]>|undefined;
export function installedPrintFonts(){return cache??=(async()=>{const result:PrintFont[]=[];for(const dir of [path.join(process.env.SystemRoot||'C:\\Windows','Fonts'),path.join(process.env.LOCALAPPDATA||'','Microsoft','Windows','Fonts')]){let names:string[];try{names=await fs.readdir(dir);}catch{continue;}for(const name of names.sort()){if(!/\.(ttf|otf|ttc)$/i.test(name))continue;const file=path.join(dir,name);try{result.push(...fontRecords(await fs.readFile(file),file));}catch{}}}return result;})();}
