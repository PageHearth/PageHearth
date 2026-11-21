import {describe,expect,it} from 'vitest';
import {detachedWindowKey} from '../src/main/detachedIdentity';

describe('detached World Bible identity',()=>{
  it('uses project, category and entity identity for independent World Bible windows',()=>{
    expect(detachedWindowKey('character','project-a','location-a','location')).toBe('world:project-a:location:location-a');
    expect(detachedWindowKey('character','project-a','location-a','location')).toBe(detachedWindowKey('character','project-a','location-a','location'));
    expect(detachedWindowKey('character','project-a','location-b','location')).not.toBe(detachedWindowKey('character','project-a','location-a','location'));
    expect(detachedWindowKey('character','project-a','entity-a','bestiary')).not.toBe(detachedWindowKey('character','project-a','entity-a','location'));
    expect(detachedWindowKey('character','project-b','location-a','location')).not.toBe(detachedWindowKey('character','project-a','location-a','location'));
  });

  it('keeps singleton keys for the established non-entity detached surfaces',()=>{
    expect(detachedWindowKey('inspector','project-a','chapter-a')).toBe('inspector');
    expect(detachedWindowKey('notebook','project-a','note-a')).toBe('notebook');
    expect(detachedWindowKey('collections','project-a','collection-a')).toBe('collections');
  });
});
