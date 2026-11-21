import type {MenuItemConstructorOptions} from 'electron';
export function manuscriptImageContextMenu(image:boolean,run:(action:string)=>void):MenuItemConstructorOptions[]{
 const entries=image?[['Replace Image…','insert-image'],['Image Properties…','image-properties'],['Copy','copy'],['Remove Image','remove']]:[['Insert Image…','insert-image'],['Paste Image','paste-image']];
 return [...entries.map(([label,action])=>({label,click:()=>run(action)})),{type:'separator'}];
}
