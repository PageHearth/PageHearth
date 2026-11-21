import {promises as fs} from 'node:fs';
import type {FileHandle} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {createInflateRaw,crc32} from 'node:zlib';
import {Zip,ZipPassThrough,Deflate} from 'fflate';

export const ARCHIVE_MAX_BYTES=1024*1024*1024;
const CHUNK=64*1024;
export function safeArchiveName(name:string){return !name.includes('\\')&&!name.includes(':')&&!name.startsWith('/')&&name.length<=240&&name.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!/[. ]$/.test(part)&&!/[<>"|?*\x00-\x1f]/.test(part)&&!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));}
export type ArchiveInput={name:string;file?:string;bytes?:Uint8Array};
export type ArchiveEntry={name:string;size:number;compressed:number;method:number;crc:number;offset:number;data:number;end:number};
function validateNames(names:string[]){const seen=new Set<string>();for(const name of names){const key=name.toLowerCase();if(!safeArchiveName(name)||seen.has(key)||key.startsWith('.storyloom/')||key.startsWith('backups/')||seen.size>=20000)throw Error('Backup contains unsafe, duplicate or oversized entries.');seen.add(key)}for(const name of seen){const parts=name.split('/');parts.pop();while(parts.length){if(seen.has(parts.join('/')))throw Error('Backup contains conflicting file and folder paths.');parts.pop()}}}
async function readAt(h:FileHandle,length:number,position:number){const b=Buffer.alloc(length);let at=0;while(at<length){const {bytesRead}=await h.read(b,at,length-at,position+at);if(!bytesRead)throw Error('Truncated ZIP archive.');at+=bytesRead}return b;}
export async function* fileChunks(h:FileHandle,start:number,length:number){let at=0;while(at<length){const bytes=await readAt(h,Math.min(CHUNK,length-at),start+at);at+=bytes.length;yield bytes;}}

// Central directory is inspected before any decompression. ZIP64/multi-disk/encrypted
// archives are outside the existing 1 GiB/20,000-entry envelope and fail closed.
export async function archiveEntries(h:FileHandle):Promise<ArchiveEntry[]>{
  const size=(await h.stat()).size;if(size>ARCHIVE_MAX_BYTES)throw Error('Backup exceeds the 1 GiB safety limit.');if(size<22)throw Error('Truncated ZIP archive.');
  const tail=await readAt(h,Math.min(size,65557),Math.max(0,size-65557));let at=tail.length-22;while(at>=0&&(tail.readUInt32LE(at)!==0x06054b50||at+22+tail.readUInt16LE(at+20)!==tail.length))at--;if(at<0)throw Error('ZIP end directory is missing.');
  const count=tail.readUInt16LE(at+10),centralSize=tail.readUInt32LE(at+12),centralOffset=tail.readUInt32LE(at+16),endOffset=size-tail.length+at;
  if(tail.readUInt16LE(at+4)||tail.readUInt16LE(at+6)||tail.readUInt16LE(at+8)!==count||count>20000||centralOffset+centralSize!==endOffset)throw Error('Unsupported or damaged ZIP directory.');
  const entries:ArchiveEntry[]=[];let position=centralOffset,total=0;
  for(let i=0;i<count;i++){
    const c=await readAt(h,46,position);if(c.readUInt32LE(0)!==0x02014b50)throw Error('Invalid ZIP entry.');const flags=c.readUInt16LE(8),method=c.readUInt16LE(10),compressed=c.readUInt32LE(20),original=c.readUInt32LE(24),nameLength=c.readUInt16LE(28),extra=c.readUInt16LE(30),comment=c.readUInt16LE(32),offset=c.readUInt32LE(42);
    if(flags&~0x080e||![0,8].includes(method)||c.readUInt16LE(34)||nameLength>960||position+46+nameLength+extra+comment>endOffset)throw Error('Unsupported ZIP entry encoding.');
    const rawName=await readAt(h,nameLength,position+46),name=new TextDecoder('utf-8',{fatal:true}).decode(rawName);total+=original;if(total>ARCHIVE_MAX_BYTES)throw Error('Backup contains unsafe, duplicate or oversized entries.');
    const local=await readAt(h,30,offset);if(local.readUInt32LE(0)!==0x04034b50||local.readUInt16LE(6)!==flags||local.readUInt16LE(8)!==method||local.readUInt16LE(26)!==nameLength)throw Error('ZIP local header mismatch.');
    if(!(await readAt(h,nameLength,offset+30)).equals(rawName))throw Error('ZIP local filename mismatch.');const data=offset+30+nameLength+local.readUInt16LE(28),end=data+compressed;if(end>centralOffset)throw Error('ZIP data overlaps directory.');
    if(!(flags&8)&&(local.readUInt32LE(14)!==c.readUInt32LE(16)||local.readUInt32LE(18)!==compressed||local.readUInt32LE(22)!==original))throw Error('ZIP local sizes mismatch.');
    entries.push({name,size:original,compressed,method,crc:c.readUInt32LE(16),offset,data,end});position+=46+nameLength+extra+comment;
  }
  if(position!==endOffset)throw Error('ZIP directory length mismatch.');validateNames(entries.map(e=>e.name));let previous=0;for(const e of [...entries].sort((a,b)=>a.offset-b.offset)){if(e.offset<previous)throw Error('Overlapping ZIP entries.');previous=e.end}return entries;
}
export async function consumeEntry(h:FileHandle,entry:ArchiveEntry,onChunk?:(bytes:Buffer)=>Promise<void>){
  const source=Readable.from(fileChunks(h,entry.data,entry.compressed)),inflate=entry.method===8?createInflateRaw({chunkSize:CHUNK}):undefined,output=inflate?source.pipe(inflate):source;let size=0,crc=0;const sha=createHash('sha256');if(inflate)source.on('error',error=>inflate.destroy(error));
  try{for await(const chunk of output){const bytes=chunk as Buffer;size+=bytes.length;if(size>entry.size||size>ARCHIVE_MAX_BYTES)throw Error('Backup expansion exceeds declared size.');crc=crc32(bytes,crc);sha.update(bytes);await onChunk?.(bytes)}if(size!==entry.size||crc!==entry.crc||(inflate&&inflate.bytesWritten!==entry.compressed))throw Error('Backup ZIP integrity check failed.');return sha.digest('hex');}finally{source.destroy();inflate?.destroy()}
}
// Zip retains per-entry directory metadata until end(). Its stock ZipDeflate
// also retains the finished compressor. Release that chunk buffer explicitly.
class BoundedDeflate extends ZipPassThrough{
  private state:{compressor?:Deflate}={};
  constructor(name:string){super(name);this.compression=8;this.state.compressor=new Deflate({level:1},(chunk,final)=>this.ondata(null,chunk,final));}
  protected process(chunk:Uint8Array,final:boolean){try{this.state.compressor!.push(chunk,final)}finally{if(final)this.state.compressor=undefined}}
}
// Each compressor push is bounded, and output is drained before reading another
// input chunk. No asset payload, complete ZIP, or asset worker message is retained.
export async function writeArchive(file:string,inputs:ArchiveInput[]){
  validateNames([...inputs.map(f=>f.name),'backup-integrity.json']);const h=await fs.open(file,'wx'),inventory:Record<string,string>=Object.create(null);let pending:Uint8Array[]=[],failure:Error|null=null,total=0,written=0;
  const zip=new Zip((error,chunk)=>{if(error)failure=error;else pending.push(chunk)});
  const drain=async()=>{if(failure)throw failure;for(const chunk of pending){written+=chunk.length;if(written>ARCHIVE_MAX_BYTES)throw Error('Backup exceeds the 1 GiB safety limit.');await h.writeFile(chunk)}pending=[]};
  async function add(input:ArchiveInput){const entry=new BoundedDeflate(input.name),sha=createHash('sha256');zip.add(entry);await drain();let source:FileHandle|undefined;try{if(input.file){source=await fs.open(input.file,'r');const stat=await source.stat();if(!stat.isFile())throw Error('Backup source is not a regular file.');for await(const chunk of fileChunks(source,0,stat.size)){total+=chunk.length;if(total>ARCHIVE_MAX_BYTES)throw Error('Backup exceeds the 1 GiB safety limit.');sha.update(chunk);entry.push(chunk,false);await drain()}const after=await source.stat();if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)throw Error('Backup source changed while reading.');}else{const bytes=input.bytes!;for(let at=0;at<bytes.length;at+=CHUNK){const chunk=bytes.subarray(at,at+CHUNK);total+=chunk.length;if(total>ARCHIVE_MAX_BYTES)throw Error('Backup exceeds the 1 GiB safety limit.');sha.update(chunk);entry.push(chunk,false);await drain()}}entry.push(new Uint8Array(),true);await drain();inventory[input.name]=sha.digest('hex')}finally{await source?.close()}}
  try{for(const input of inputs)await add(input);await add({name:'backup-integrity.json',bytes:Buffer.from(JSON.stringify(inventory,null,2)+'\n')});zip.end();await drain();await h.sync()}finally{zip.terminate();await h.close()}
}
