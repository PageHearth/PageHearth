import {inflateSync,deflateSync} from 'node:zlib';
import type {EbookAsset} from './epubRenderer.js';
const crc=(b:Buffer)=>{let c=0xffffffff;for(const byte of b){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
const chunk=(tag:string,data:Buffer)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(tag,4,4,'ascii');data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b;};
/** Lossless PNG derivative only when smaller; JPEG bytes are preserved. No print DPI rules. */
export function ebookImage(input:Buffer,optimize=true):EbookAsset{
 if(input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
  const chunks:{tag:string;data:Buffer;raw:Buffer}[]=[];let at=8,ended=false;
  while(at+12<=input.length){const size=input.readUInt32BE(at),end=at+size+12;if(end>input.length)throw Error('Truncated PNG image.');const raw=input.subarray(at,end),tag=raw.toString('ascii',4,8);if(crc(raw.subarray(4,-4))!==raw.readUInt32BE(raw.length-4))throw Error('Damaged PNG image.');chunks.push({tag,data:raw.subarray(8,-4),raw});at=end;if(tag==='IEND'){ended=true;break;}}
  const header=chunks[0];if(!ended||header?.tag!=='IHDR'||header.data.length!==13)throw Error('Invalid PNG image.');const width=header.data.readUInt32BE(0),height=header.data.readUInt32BE(4);if(!width||!height||width*height>32_000_000)throw Error('PNG exceeds the safe 32-megapixel eBook limit.');
  const compressed=Buffer.concat(chunks.filter(c=>c.tag==='IDAT').map(c=>c.data)),raw=inflateSync(compressed,{maxOutputLength:Math.min(256*1024*1024,width*height*8+height*16+1024)});if(!optimize)return {bytes:input,mime:'image/png',width,height};const optimized=deflateSync(raw,{level:9});let inserted=false;const derivative=Buffer.concat([input.subarray(0,8),...chunks.flatMap(c=>{if(c.tag!=='IDAT')return [c.raw];if(inserted)return [];inserted=true;return [chunk('IDAT',optimized)];})]);
  return {bytes:derivative.length<input.length?derivative:input,mime:'image/png',width,height};
 }
 if(input[0]===255&&input[1]===216){let at=2;while(at+4<input.length){if(input[at++]!==255)break;let marker=input[at++];while(marker===255)marker=input[at++];if(marker===0xda||marker===0xd9)break;const size=input.readUInt16BE(at);if(size<2||at+size>input.length)break;if([0xc0,0xc1,0xc2].includes(marker)&&size>=8){const height=input.readUInt16BE(at+3),width=input.readUInt16BE(at+5);if(!width||!height||width*height>32_000_000)throw Error('JPEG exceeds the safe 32-megapixel eBook limit.');return {bytes:input,mime:'image/jpeg',width,height};}at+=size;}throw Error('JPEG dimensions could not be verified.');
 }
 throw Error('eBooks support PNG and JPEG images.');
}
