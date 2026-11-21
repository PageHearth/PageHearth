import {afterEach,expect,it,vi} from 'vitest';
import {TemporaryTreeNotice} from '../src/renderer/temporaryTreeNotice';
afterEach(()=>vi.useRealTimers());
it('keeps temporary feedback for five seconds then clears it',()=>{
  vi.useFakeTimers();const display=vi.fn(),notice=new TemporaryTreeNotice(display);
  notice.show('Invalid nesting');vi.advanceTimersByTime(4999);expect(display.mock.calls).toEqual([['Invalid nesting']]);
  vi.advanceTimersByTime(1);expect(display).toHaveBeenLastCalledWith('');expect(vi.getTimerCount()).toBe(0);
});
it('manual dismissal clears the message and pending timeout immediately',()=>{
  vi.useFakeTimers();const display=vi.fn(),notice=new TemporaryTreeNotice(display);
  notice.show('Invalid nesting');notice.dismiss();expect(display).toHaveBeenLastCalledWith('');expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(10000);expect(display).toHaveBeenCalledTimes(2);
});
it('restarts the deadline for identical as well as different messages',()=>{
  vi.useFakeTimers();const display=vi.fn(),notice=new TemporaryTreeNotice(display);
  notice.show('Invalid nesting');vi.advanceTimersByTime(4000);notice.show('Invalid nesting');vi.advanceTimersByTime(4000);
  expect(display).toHaveBeenLastCalledWith('Invalid nesting');expect(vi.getTimerCount()).toBe(1);
  notice.show('Different rejection');vi.advanceTimersByTime(4999);expect(display).toHaveBeenLastCalledWith('Different rejection');
  vi.advanceTimersByTime(1);expect(display).toHaveBeenLastCalledWith('');
});
it('unmount cleanup cancels callbacks without updating an unmounted component',()=>{
  vi.useFakeTimers();const display=vi.fn(),notice=new TemporaryTreeNotice(display);
  notice.show('Invalid nesting');notice.dispose();notice.dispose();expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(10000);expect(display.mock.calls).toEqual([['Invalid nesting']]);
  // React StrictMode cleanup/setup can reuse the controller.
  notice.show('New operation');vi.advanceTimersByTime(5000);expect(display).toHaveBeenLastCalledWith('');
});
