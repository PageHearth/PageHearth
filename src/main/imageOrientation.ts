import {deflateSync} from 'node:zlib';
/** Read only EXIF orientation; never trust an offset outside its APP1 segment. */
export function jpegOrientation(bytes:Buffer):number{
 if(bytes[0]!==255||bytes[1]!==216)return 1;
 for(let at=2;at+4<=bytes.length;){if(bytes[at++]!==255)break;let marker=bytes[at++];while(marker===255)marker=bytes[at++];if(marker===0xda||marker===0xd9)break;const length=bytes.readUInt16BE(at);if(length<2||at+length>bytes.length)throw Error('Damaged JPEG image.');
  if(marker===0xe1&&bytes.subarray(at+2,at+8).toString('binary')==='Exif\0\0'){
   const t=bytes.subarray(at+8,at+length),little=t.subarray(0,2).toString()==='II';if(!little&&t.subarray(0,2).toString()!=='MM')throw Error('Damaged JPEG orientation metadata.');
   const read=(offset:number,size:number)=>{if(offset<0||offset+size>t.length)throw Error('Damaged JPEG orientation metadata.');return size===2?(little?t.readUInt16LE(offset):t.readUInt16BE(offset)):(little?t.readUInt32LE(offset):t.readUInt32BE(offset));};
   if(read(2,2)!==42)throw Error('Damaged JPEG orientation metadata.');const start=read(4,4),count=read(start,2);for(let i=0;i<count;i++){const p=start+2+i*12;if(read(p,2)===274){if(read(p+2,2)!==3||read(p+4,4)!==1)throw Error('Unsupported JPEG orientation metadata.');const orientation=read(p+8,2);if(orientation<1||orientation>8)throw Error('Unsupported JPEG orientation metadata.');return orientation;}}
  }at+=length;
 }return 1;
}
const crc=(b:Buffer)=>{let c=0xffffffff;for(const byte of b){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
const chunk=(tag:string,data:Buffer)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(tag,4);data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b;};
/** Windows nativeImage supplies BGRA. Lossless orientation derivative, not a pixel editor. */
export function orientedPng(bitmap:Buffer,width:number,height:number,orientation:number){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>32_000_000||bitmap.length!==width*height*4||!Number.isInteger(orientation)||orientation<1||orientation>8)throw Error('Image dimensions could not be verified.');
 const w=orientation>=5?height:width,h=orientation>=5?width:height,raw=Buffer.alloc(h*(w*4+1));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){let dx=x,dy=y;
  if(orientation===2)dx=width-1-x;else if(orientation===3){dx=width-1-x;dy=height-1-y;}else if(orientation===4)dy=height-1-y;else if(orientation===5){dx=y;dy=x;}else if(orientation===6){dx=height-1-y;dy=x;}else if(orientation===7){dx=height-1-y;dy=width-1-x;}else if(orientation===8){dx=y;dy=width-1-x;}
  const from=(y*width+x)*4,to=dy*(w*4+1)+1+dx*4;raw[to]=bitmap[from+2];raw[to+1]=bitmap[from+1];raw[to+2]=bitmap[from];raw[to+3]=bitmap[from+3];
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
