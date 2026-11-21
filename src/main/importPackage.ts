import {inflateRawSync,crc32} from 'node:zlib';
import {SaxesParser} from 'saxes';
export const IMPORT_LIMITS={source:64*1024*1024,expanded:128*1024*1024,entry:32*1024*1024,entries:10000,blocks:100000,depth:80,text:2*1024*1024};
/** Foreign packages stay in memory. Backup acceptance rules remain unchanged. */
export function foreignPackage(bytes:Buffer){
 if(bytes.length>IMPORT_LIMITS.source||bytes.readUInt32LE(0)!==0x04034b50)throw Error('Not a supported document package.');
 let end=bytes.length-22;while(end>=Math.max(0,bytes.length-65557)&&(bytes.readUInt32LE(end)!==0x06054b50||end+22+bytes.readUInt16LE(end+20)!==bytes.length))end--;
 if(end<0||bytes.readUInt32LE(end)!==0x06054b50)throw Error('Damaged document package.');
 const count=bytes.readUInt16LE(end+10);let at=bytes.readUInt32LE(end+16),total=0;const names=new Set<string>(),files=new Map<string,Buffer>();
 if(count>IMPORT_LIMITS.entries||bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||bytes.readUInt16LE(end+8)!==count||at+bytes.readUInt32LE(end+12)!==end)throw Error('Unsupported or oversized document package.');
 const ranges:{start:number;end:number}[]=[];
 for(let i=0;i<count;i++){
  if(at+46>end||bytes.readUInt32LE(at)!==0x02014b50)throw Error('Damaged package directory.');const flags=bytes.readUInt16LE(at+8),method=bytes.readUInt16LE(at+10),crc=bytes.readUInt32LE(at+16),packed=bytes.readUInt32LE(at+20),size=bytes.readUInt32LE(at+24),nl=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),offset=bytes.readUInt32LE(at+42);
  if(flags&1)throw Error('This file is protected. Save an unprotected copy and try again.');
  if(flags&~0x080e||![0,8].includes(method)||bytes.readUInt16LE(at+34)||at+46+nl+extra+comment>end||offset+30>at)throw Error('Unsupported package entry.');
  const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(at+46,at+46+nl)),clean=name.replace(/\/$/,'');
  if(!clean||clean.length>500||/[\\:\x00-\x1f]/.test(clean)||clean.startsWith('/')||clean.split('/').some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p))||names.has(clean.toLowerCase()))throw Error('Unsafe or duplicate package path.');names.add(clean.toLowerCase());
  total+=size;if(total>IMPORT_LIMITS.expanded||size>IMPORT_LIMITS.entry)throw Error('Document package exceeds safe expanded-size limits.');
  if(bytes.readUInt32LE(offset)!==0x04034b50||bytes.readUInt16LE(offset+6)!==flags||bytes.readUInt16LE(offset+8)!==method||bytes.readUInt16LE(offset+26)!==nl||!bytes.subarray(offset+30,offset+30+nl).equals(bytes.subarray(at+46,at+46+nl)))throw Error('Package headers disagree.');
  const data=offset+30+nl+bytes.readUInt16LE(offset+28);if(data+packed>bytes.readUInt32LE(end+16))throw Error('Package entries overlap the directory.');ranges.push({start:offset,end:data+packed});
  const value=method===0?bytes.subarray(data,data+packed):inflateRawSync(bytes.subarray(data,data+packed),{maxOutputLength:Math.max(1,size)});if(value.length!==size||crc32(value)!==crc)throw Error('Package integrity check failed.');
  if(!name.endsWith('/'))files.set(name,value);at+=46+nl+extra+comment;
 }
 if(at!==end)throw Error('Damaged package directory.');let previous=0;for(const r of ranges.sort((a,b)=>a.start-b.start)){if(r.start<previous)throw Error('Overlapping package entries.');previous=r.end;}return files;
}
export type XmlNode={name:string;uri:string;attrs:Record<string,string>;children:XmlNode[];text:string};
export function xml(bytes:Buffer):XmlNode{
 const root:XmlNode={name:'root',uri:'',attrs:{},children:[],text:''},stack=[root];let count=0;const parser=new SaxesParser({xmlns:true});
 parser.on('doctype',()=>{throw Error('Document XML declarations with external/entity definitions are not supported.');});parser.on('error',e=>{throw e;});
 parser.on('opentag',tag=>{if(stack.length>IMPORT_LIMITS.depth||++count>500000)throw Error('Document XML is too complex.');const n:XmlNode={name:tag.local,uri:tag.uri,attrs:Object.fromEntries(Object.values(tag.attributes).map(a=>[a.name,a.value])),children:[],text:''};stack.at(-1)!.children.push(n);stack.push(n);});
 parser.on('text',value=>{const node=stack.at(-1)!;node.text+=value;if(node.text.length>IMPORT_LIMITS.text)throw Error('Document text item is too large.');});parser.on('closetag',()=>{stack.pop();});parser.write(new TextDecoder('utf-8',{fatal:true}).decode(bytes)).close();return root;
}
export function elements(node:XmlNode,name:string):XmlNode[]{return [...(node.name===name?[node]:[]),...node.children.flatMap(c=>elements(c,name))];}
