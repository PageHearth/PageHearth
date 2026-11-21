export type ClipboardImageItem={types:readonly string[];getType(type:string):Promise<unknown>};

export async function firstClipboardPng(items:readonly ClipboardImageItem[],encode:(bytes:Buffer)=>Buffer):Promise<Buffer|undefined>{
  for(const item of items){
    const imageType=item.types.find(type=>type.startsWith('image/'));
    if(!imageType)continue;
    const value=await item.getType(imageType);
    if(!(value instanceof Blob))continue;
    const png=encode(Buffer.from(await value.arrayBuffer()));
    if(png.length)return png;
  }
  return undefined;
}
