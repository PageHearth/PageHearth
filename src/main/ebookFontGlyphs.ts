/** Read SFNT Unicode cmap without executing font code. Unknown tables are reported, never assumed covered. */
export function missingFontGlyphs(bytes:Uint8Array,text:string):string[]|null{
 try{const b=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let cmap=0;for(let i=0;i<b.getUint16(4);i++){const o=12+i*16;if(b.getUint32(o)===0x636d6170)cmap=b.getUint32(o+8);}if(!cmap)return null;
 const tables:number[]=[];for(let i=0;i<b.getUint16(cmap+2);i++){const o=cmap+4+i*8,platform=b.getUint16(o),encoding=b.getUint16(o+2);if(platform===0||platform===3&&[1,10].includes(encoding))tables.push(cmap+b.getUint32(o+4));}
 const format12=tables.find(o=>b.getUint16(o)===12),format4=tables.find(o=>b.getUint16(o)===4);if(format12===undefined&&format4===undefined)return null;
 const has=(cp:number)=>{if(format12!==undefined){const n=b.getUint32(format12+12);if(n>1000000)throw Error('Invalid cmap');let lo=0,hi=n-1;while(lo<=hi){const mid=(lo+hi)>>>1,o=format12+16+mid*12,start=b.getUint32(o),end=b.getUint32(o+4);if(cp<start)hi=mid-1;else if(cp>end)lo=mid+1;else return b.getUint32(o+8)+cp-start!==0;}return false;}
 if(cp>65535||format4===undefined)return false;const count=b.getUint16(format4+6)/2,end=format4+14,start=end+count*2+2,delta=start+count*2,range=delta+count*2;for(let i=0;i<count;i++){if(cp>b.getUint16(end+i*2))continue;if(cp<b.getUint16(start+i*2))return false;const d=b.getInt16(delta+i*2),r=b.getUint16(range+i*2);if(!r)return ((cp+d)&65535)!==0;const glyph=b.getUint16(range+i*2+r+(cp-b.getUint16(start+i*2))*2);return glyph!==0&&((glyph+d)&65535)!==0;}return false;};
 return [...new Set([...text].filter(c=>!/\s/u.test(c)&&!has(c.codePointAt(0)!)))].slice(0,32);
 }catch{return null;}
}
