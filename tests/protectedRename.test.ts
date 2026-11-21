import {it,expect,vi,afterEach} from 'vitest';
import {renameProtected,protectedRenameDelays} from '../src/main/protectedRename';
import {Store} from '../src/main/storage';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
afterEach(()=>vi.restoreAllMocks());
it.each(['EPERM','EBUSY','EACCES'])('bounds transient %s replacement retries with exact backoff',async code=>{
 const error=Object.assign(Error(code),{code});const rename=vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined),pause=vi.fn().mockResolvedValue(undefined);
 await renameProtected('tmp','draft',rename,pause,'win32');expect(rename).toHaveBeenCalledTimes(2);expect(pause).toHaveBeenCalledWith(10);
 rename.mockReset().mockRejectedValue(error);pause.mockClear();await expect(renameProtected('tmp','draft',rename,pause,'win32')).rejects.toBe(error);expect(rename).toHaveBeenCalledTimes(5);expect(pause.mock.calls.flat()).toEqual([...protectedRenameDelays]);
});
it.each(['ENOSPC','ENOENT','EIO'])('does not conceal %s',async code=>{const rename=vi.fn().mockRejectedValue(Object.assign(Error(code),{code})),pause=vi.fn();await expect(renameProtected('tmp','draft',rename,pause,'win32')).rejects.toThrow(code);expect(rename).toHaveBeenCalledTimes(1);expect(pause).not.toHaveBeenCalled();});
it('does not retry non-Windows permission denial',async()=>{const rename=vi.fn().mockRejectedValue(Object.assign(Error('denied'),{code:'EPERM'}));await expect(renameProtected('t','d',rename,async()=>{},'linux')).rejects.toThrow('denied');expect(rename).toHaveBeenCalledTimes(1);});
it('real protected files retain latest acknowledged bytes, no temporary authority, and usable queue after exhaustion',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-retry-')),store=new Store(root);const real=fs.rename;
 const doc=(text:string)=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
 try{await store.create('Retry');const id=store.project.manifest.nodes[0].id,dir=path.join(root,'.storyloom','drafts'),file=path.join(dir,id+'.json');let failures=1;
 vi.spyOn(fs,'rename').mockImplementation(async(from,to)=>{if(String(to)===file&&failures-->0)throw Object.assign(Error('locked'),{code:'EBUSY'});await real(from,to);});
 await store.stageDocument(id,doc('first acknowledged'));expect(JSON.parse(await fs.readFile(file,'utf8')).document).toEqual(doc('first acknowledged'));
 failures=5;await expect(store.stageDocument(id,doc('unacknowledged'))).rejects.toThrow('locked');expect(JSON.parse(await fs.readFile(file,'utf8')).document).toEqual(doc('first acknowledged'));expect(await fs.readdir(dir)).toEqual([id+'.json']);
 failures=1;await Promise.all(Array.from({length:30},(_,i)=>store.stageDocument(id,doc('latest '+i))));expect(JSON.parse(await fs.readFile(file,'utf8')).document).toEqual(doc('latest 29'));expect(await fs.readdir(dir)).toEqual([id+'.json']);
 }finally{vi.restoreAllMocks();await store.release();await fs.rm(root,{recursive:true,force:true});}
});
