import {it,expect,vi} from 'vitest';
import {createUpdateAdapter,parseRelease,downloadDestination,validReleaseUrl,releaseApi,officialDownloadPage} from '../src/main/updateAdapter';
import {readFileSync} from 'node:fs';
const release=(tag='v1.10.0')=>({tag_name:tag,draft:false,prerelease:false,html_url:'https://github.com/PageHearth/PageHearth/releases/tag/'+tag,body:'<script>bad()</script> Notes'});
it('Beta 1 discovers stable 1.0.0 and Download opens the official repository without a website',async()=>{
 const request=vi.fn(async()=>new Response(JSON.stringify(release('v1.0.0'))));const open=vi.fn(async()=>{});
 const adapter=createUpdateAdapter('0.1.2',open,request as typeof fetch);const result=await adapter.check();
 expect(releaseApi).toBe('https://api.github.com/repos/PageHearth/PageHearth/releases/latest');
 expect(result?.version).toBe('1.0.0');await adapter.open(result!,'download');
 expect(open).toHaveBeenCalledExactlyOnceWith('https://github.com/PageHearth/PageHearth/releases/tag/v1.0.0');
 expect(JSON.parse(readFileSync('package.json','utf8')).repository.url).toBe('https://github.com/PageHearth/PageHearth.git');
});
it('rejects the former development release destination',()=>{
 const url='https://github.com/ThatsHush/StoryLoom/releases/tag/v1.0.0';
 expect(validReleaseUrl(url)).toBe(false);expect(()=>parseRelease({...release('v1.0.0'),html_url:url},'0.1.2')).toThrow('Invalid release URL');
});
it.each(['1.10.0','v1.10.0'])('proper semantic version comparison %s',tag=>expect(parseRelease(release(tag),'1.9.0')?.version).toBe('1.10.0'));
it.each(['1.10.0','1.11.0'])('current or older release %s',current=>expect(parseRelease(release(),current)).toBeNull());
it.each(['nonsense','1.2','v1.0.0-beta.1','0.1.200','0.1.201'])('ignores malformed, pre-release and historical QA version %s',tag=>expect(()=>parseRelease(release(tag),'0.1.2')).toThrow('NO_RELEASE'));
it.each(['draft','prerelease'])('ignores %s',key=>expect(()=>parseRelease({...release(),[key]:true},'0.1.2')).toThrow('NO_RELEASE'));
it.each(['file:///secret','javascript:alert(1)','data:text/html,x','http://github.com/PageHearth/PageHearth/releases/tag/v1.10.0','https://github.com/Other/Repo/releases/tag/v1.10.0','https://github.com@evil.com/PageHearth/PageHearth/releases/tag/v1.10.0','https://github.com/PageHearth/PageHearth/releases/tag/v1.10.0?redirect=evil','https://github.com/PageHearth/PageHearth/releases/tag/v1.10.0#fragment'])('rejects unsafe URL %s',url=>{expect(validReleaseUrl(url)).toBe(false);expect(()=>parseRelease({...release(),html_url:url},'0.1.2')).toThrow();});
it('requires release URL to match detected version',()=>expect(()=>parseRelease({...release(),html_url:release('v2.0.0').html_url},'0.1.2')).toThrow());
it('centralized official route and exact GitHub fallback',()=>{const r=parseRelease(release(),'0.1.2')!;expect(downloadDestination(r,'download',true)).toBe(officialDownloadPage);expect(downloadDestination(r,'download',false)).toBe(r.url);expect(downloadDestination(r,'github',true)).toBe(r.url);});
it('requests only public metadata, no credentials/project data, then opens only validated main-owned destination',async()=>{const request=vi.fn(async()=>new Response(JSON.stringify(release())));const open=vi.fn(async()=>{});const a=createUpdateAdapter('1.9.0',open,request as typeof fetch);const r=await a.check();expect(request).toHaveBeenCalledWith(releaseApi,expect.objectContaining({redirect:'error',headers:{Accept:'application/vnd.github+json','User-Agent':'PageHearth','X-GitHub-Api-Version':'2022-11-28'}}));await a.open(r!,'download');expect(open).toHaveBeenCalledWith(r!.url);});
it.each([[404,'NO_RELEASE'],[403,'RATE_LIMIT'],[429,'RATE_LIMIT'],[500,'unavailable']])('HTTP %s',async(status,message)=>{const a=createUpdateAdapter('0.1.2',async()=>{},(async()=>new Response('',{status:Number(status)})) as typeof fetch);await expect(a.check()).rejects.toThrow(String(message));});
it.each(['ENOTFOUND','TimeoutError'])('propagates %s for readable service handling',async message=>{const a=createUpdateAdapter('0.1.2',async()=>{},(async()=>{throw Error(message);}) as typeof fetch);await expect(a.check()).rejects.toThrow(message);});
it.each(['not json','{}','[]'])('rejects malformed payload %s',async body=>{await expect(createUpdateAdapter('0.1.2',async()=>{},(async()=>new Response(body)) as typeof fetch).check()).rejects.toThrow();});
it('bounds response memory and notes',async()=>{await expect(createUpdateAdapter('0.1.2',async()=>{},(async()=>new Response('x'.repeat(1048577))) as typeof fetch).check()).rejects.toThrow('too large');expect(parseRelease({...release(),body:'x'.repeat(30000)},'0.1.2')!.notes).toHaveLength(20000);});
it('production has no updater dependency, QA identity, configurable feed, or shutdown hook',()=>{const pkg=JSON.parse(readFileSync('package.json','utf8'));expect(pkg.dependencies['electron-updater']).toBeUndefined();expect(pkg.build.publish).toBeNull();const main=readFileSync('src/main/main.ts','utf8');expect(main).not.toMatch(/updaterQA|updatePreparing|__pagehearthUpdatePrepare|quitAndInstall/);expect(main).toContain('createUpdateAdapter(app.getVersion(),url=>shell.openExternal(url))');expect(main).toContain('updates.check(false),10000');});
