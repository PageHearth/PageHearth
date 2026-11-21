import {it,expect,vi,afterEach} from 'vitest';
import {emphasisTimer} from '../src/renderer/commentDecorations';
afterEach(()=>vi.useRealTimers());
it('clears emphasis at three seconds',()=>{vi.useFakeTimers();const clear=vi.fn(),timer=emphasisTimer(clear);timer.restart();vi.advanceTimersByTime(2999);expect(clear).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(clear).toHaveBeenCalledTimes(1);});
it('repeated navigation replaces the old timeout',()=>{vi.useFakeTimers();const clear=vi.fn(),timer=emphasisTimer(clear);timer.restart();vi.advanceTimersByTime(2000);timer.restart();vi.advanceTimersByTime(1000);expect(clear).not.toHaveBeenCalled();vi.advanceTimersByTime(2000);expect(clear).toHaveBeenCalledTimes(1);});
it('document/pane disposal cancels the pending timer',()=>{vi.useFakeTimers();const clear=vi.fn(),timer=emphasisTimer(clear);timer.restart();timer.cancel();vi.advanceTimersByTime(5000);expect(clear).not.toHaveBeenCalled();});
