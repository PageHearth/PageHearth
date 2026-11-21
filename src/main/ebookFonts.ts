import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {installedPrintFonts,embeddingAllowed} from './printFonts.js';
import type {EbookFont} from './epubRenderer.js';

export const libertinusHash='fcf06307a77367394fcb0ccb241e59eea70dba3d732be309647611224679c733';
/** EPUB-only resources. Never install fonts or change Typst's catalog. */
export async function loadEbookFont(family:string,resources:string,catalog=installedPrintFonts):Promise<EbookFont|undefined>{
 if(family==='Libertinus Serif'){
  const bytes=await fs.readFile(path.join(resources,'fonts/LibertinusSerif-Regular.otf'));
  if(createHash('sha256').update(bytes).digest('hex')!==libertinusHash)throw Error('Bundled Libertinus font integrity check failed.');
  const notice=await fs.readFile(path.join(resources,'fonts/Libertinus-OFL.txt'),'utf8');
  if(!notice.includes('SIL OPEN FONT LICENSE Version 1.1')||!notice.includes('The Libertinus Project Authors'))throw Error('Bundled Libertinus license notice is missing.');
  return {bytes,format:'otf',family,notice};
 }
 const available=(await catalog()).filter(f=>f.family===family&&embeddingAllowed(f.fsType)&&/\.(ttf|otf)$/i.test(f.file));
 const regular=available.find(f=>!/(bold|italic|oblique)/i.test(path.basename(f.file)))||available[0];
 if(regular&&(await fs.stat(regular.file)).size<=16*1024*1024)return {bytes:await fs.readFile(regular.file),format:path.extname(regular.file).toLowerCase()==='.otf'?'otf':'ttf',family:regular.family};
}
