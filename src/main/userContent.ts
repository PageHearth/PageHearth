import path from 'node:path';
import {promises as fs} from 'node:fs';
import {requireTemplate} from '../shared/templateSafety.js';
import {ordinaryDirectory} from './templateFiles.js';
export function userContentPaths(home:string){requireTemplate(path.isAbsolute(home),'PATH','An absolute home directory is required.');const root=path.join(home,'PageHearth');return {root,projects:path.join(root,'Projects'),templates:path.join(root,'Templates')};}
export async function ensureContentDirectory(directory:string){requireTemplate(path.isAbsolute(directory),'PATH','An absolute directory is required.');let at=path.parse(directory).root;for(const part of path.resolve(directory).slice(at.length).split(path.sep).filter(Boolean)){at=path.join(at,part);try{await fs.mkdir(at);}catch(e:any){if(e.code!=='EEXIST')throw e;}await ordinaryDirectory(at);}return directory;}
