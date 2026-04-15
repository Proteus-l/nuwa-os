import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SystemClock } from '../src/system-clock.js';

describe('SystemClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return 0 from now() before start is called', () => {
    const clock = new SystemClock();
    expect(clock.now()).toBe(0);
  });

  it('should return 0 from elapsed() before start is called', () => {
    const clock = new SystemClock();
    expect(clock.elapsed()).toBe(0);
  });

  it('should track elapsed time after start', () => {
    const clock = new SystemClock();
    clock.start();

    vi.advanceTimersByTime(100);
    expect(clock.now()).toBe(100);
    expect(clock.elapsed()).toBe(100);
  });

  it('elapsed should equal now', () => {
    const clock = new SystemClock();
    clock.start();

    vi.advanceTimersByTime(250);
    expect(clock.elapsed()).toBe(clock.now());
  });

  it('timeScale getter should return the current scale', () => {
    const clock = new SystemClock();
    expect(clock.timeScale).toBe(1);
  });

  it('timeScale setter should update the scale', () => {
    const clock = new SystemClock();
    clock.timeScale = 3;
    expect(clock.timeScale).toBe(3);
  });

  it('timeScale should affect elapsed time', () => {
    const clock = new SystemClock();
    clock.timeScale = 2;
    clock.start();

    vi.advanceTimersByTime(100);
    expect(clock.now()).toBe(200);
  });

  it('timeScale of 0.5 should halve elapsed time', () => {
    const clock = new SystemClock();
    clock.timeScale = 0.5;
    clock.start();

    vi.advanceTimersByTime(200);
    expect(clock.now()).toBe(100);
  });

  it('pause should freeze the clock', () => {
    const clock = new SystemClock();
    clock.start();

    vi.advanceTimersByTime(100);
    clock.pause();

    const frozenTime = clock.now();
    vi.advanceTimersByTime(500);
    expect(clock.now()).toBe(frozenTime);
  });

  it('resume should continue from where it was paused', () => {
    const clock = new SystemClock();
    clock.start();

    vi.advanceTimersByTime(100);
    clock.pause();

    vi.advanceTimersByTime(200); // paused for 200ms

    clock.resume();
    vi.advanceTimersByTime(50);

    // Total real time: 350ms, but 200ms was paused, so elapsed = 150
    expect(clock.now()).toBe(150);
  });

  it('multiple pause/resume cycles should accumulate paused time', () => {
    const clock = new SystemClock();
    clock.start();

    vi.advanceTimersByTime(100); // running: 100
    clock.pause();
    vi.advanceTimersByTime(50); // paused: 50
    clock.resume();

    vi.advanceTimersByTime(100); // running: 200
    clock.pause();
    vi.advanceTimersByTime(50); // paused: 100
    clock.resume();

    vi.advanceTimersByTime(100); // running: 300

    expect(clock.now()).toBe(300);
  });

  it('pause before start should be a no-op', () => {
    const clock = new SystemClock();
    clock.pause();
    // Should not throw, and now() should still be 0
    expect(clock.now()).toBe(0);
  });

  it('resume without pause should be a no-op', () => {
    const clock = new SystemClock();
    clock.start();
    vi.advanceTimersByTime(100);
    clock.resume(); // no-op since not paused
    vi.advanceTimersByTime(100);
    expect(clock.now()).toBe(200);
  });

  it('reset should clear everything', () => {
    const clock = new SystemClock();
    clock.start();
    vi.advanceTimersByTime(500);
    clock.timeScale = 3;
    clock.pause();

    clock.reset();

    expect(clock.now()).toBe(0);
    expect(clock.elapsed()).toBe(0);
    expect(clock.timeScale).toBe(1);
  });

  it('pause and timeScale should work together', () => {
    const clock = new SystemClock();
    clock.timeScale = 2;
    clock.start();

    vi.advanceTimersByTime(100); // running: 100 real = 200 scaled
    clock.pause();
    vi.advanceTimersByTime(500); // paused
    clock.resume();
    vi.advanceTimersByTime(100); // running: 200 real = 400 scaled

    expect(clock.now()).toBe(400);
  });
});
