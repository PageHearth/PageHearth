import {describe,it,expect} from 'vitest';
import {typstEnvironment} from '../src/main/typstPrint';
describe('Typst bundled runtime environment',()=>{
 it('prepends the trusted sibling JRE only in the child environment',()=>{
  const source={Path:'C:\\Windows\\System32',TYPST_PACKAGE_PATH:'C:\\untrusted',KEEP:'yes'};
  const original={...source};
  const env=typstEnvironment('C:\\Program Files\\PageHearth\\resources\\typst\\typst.exe',source,'win32');
  expect(env.Path).toBe('C:\\Program Files\\PageHearth\\resources\\epub\\java\\bin;C:\\Windows\\System32');
  expect(env.TYPST_PACKAGE_PATH).toBeUndefined();expect(env.KEEP).toBe('yes');expect(source).toEqual(original);
 });
 it('normalizes Windows PATH casing without duplicate keys and supports an absent PATH',()=>{
  const exe='C:\\app\\resources\\typst\\typst.exe';
  const env=typstEnvironment(exe,{PATH:'C:\\safe',Path:'C:\\ignored'},'win32');
  expect(Object.keys(env).filter(k=>k.toLowerCase()==='path')).toEqual(['Path']);
  expect(env.Path).toBe('C:\\app\\resources\\epub\\java\\bin;C:\\safe');
  expect(typstEnvironment(exe,{},'win32').Path).toBe('C:\\app\\resources\\epub\\java\\bin');
 });
 it('leaves non-Windows and unrelated subprocess paths unchanged',()=>{
  expect(typstEnvironment('/opt/typst',{PATH:'/usr/bin'},'linux').PATH).toBe('/usr/bin');
  expect(typstEnvironment('C:\\node.exe',{Path:'C:\\Windows'},'win32').Path).toBe('C:\\Windows');
 });
});
