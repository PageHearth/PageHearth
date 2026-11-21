import {afterEach,expect,it,vi} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ManualSaveFeedback} from '../src/renderer/manualSaveFeedback';
import {ShellNavigation} from '../src/renderer/AppShell';
import ShellDialog from '../src/renderer/ShellDialog';
import {commandDescriptor,commandBinding} from '../src/shared/commands';

afterEach(()=>vi.useRealTimers());
it('manual success occupies one transient slot and repeated saves restart its lifetime',()=>{
 vi.useFakeTimers();let visible=false;const feedback=new ManualSaveFeedback(value=>visible=value);
 expect(visible).toBe(false);feedback.success(feedback.begin());expect(visible).toBe(true);
 vi.advanceTimersByTime(2000);feedback.success(feedback.begin());vi.advanceTimersByTime(1000);expect(visible).toBe(true);
 vi.advanceTimersByTime(1500);expect(visible).toBe(false);expect(vi.getTimerCount()).toBe(0);
});
it('failure, edits and project changes invalidate pending success; a failed save cannot acknowledge',()=>{
 vi.useFakeTimers();const show=vi.fn(),feedback=new ManualSaveFeedback(show),ticket=feedback.begin();
 feedback.clear();feedback.success(ticket);expect(show).not.toHaveBeenCalledWith(true);
 feedback.success(feedback.begin());feedback.clear();expect(show).toHaveBeenLastCalledWith(false);
 expect(vi.getTimerCount()).toBe(0);
});
it('newer explicit saves supersede older in-flight acknowledgments',()=>{
 const show=vi.fn(),feedback=new ManualSaveFeedback(show),old=feedback.begin();feedback.begin();feedback.success(old);
 expect(show).not.toHaveBeenCalledWith(true);
});
it('internal header contains Revision directly after Home with no duplicate title slot',()=>{
 const html=renderToStaticMarkup(React.createElement(ShellNavigation,{mode:'WRITE',workspace:'editor',busy:false,hasProject:true,onHome:()=>{},onMode:()=>{},onWorkspace:()=>{},revision:React.createElement('button',null,'Revision: Off')}));
 expect(html).not.toContain('shell-project-title');expect(html).toContain('</button><button>Revision: Off</button>');
});
it('settings exposes scoped global appearance, zoom and shortcut controls',()=>{
 const html=renderToStaticMarkup(React.createElement(ShellDialog,{kind:'settings',zoom:115,onZoom:()=>{},onShortcuts:()=>{},onClose:()=>{}}));
 expect(html).toContain('Appearance');expect(html).toContain('Application theme');expect(html).toContain('PageHearth Light');expect(html).toContain('Preferences for this computer');expect(html).toContain('Shared across projects');expect(html).toContain('115%');expect(html).toContain('Keyboard Shortcuts');expect(html).toContain('Automatically check for PageHearth updates');
});
it('global shell commands share registry availability without new accelerator collisions',()=>{
 for(const id of ['new-project','open-project','settings','about'] as const){expect(commandDescriptor(id)?.context).toBe('any');expect(commandBinding(id)).toBe('');}
 expect(commandBinding('save')).toBe('Ctrl+S');expect(commandBinding('focus-mode')).toBe('F8');
});
