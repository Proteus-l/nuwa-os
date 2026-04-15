import { describe, it, expect } from 'vitest';
import { TopicMatcher } from '../src/topic-matcher.js';

describe('TopicMatcher', () => {
  // --- Exact match ---
  it('exact match: sensor.camera matches sensor.camera', () => {
    expect(TopicMatcher.matches('sensor.camera', 'sensor.camera')).toBe(true);
  });

  it('exact match fails: sensor.camera does NOT match sensor.temperature', () => {
    expect(TopicMatcher.matches('sensor.camera', 'sensor.temperature')).toBe(false);
  });

  it('exact match: single segment', () => {
    expect(TopicMatcher.matches('sensor', 'sensor')).toBe(true);
  });

  it('exact match: three segments', () => {
    expect(TopicMatcher.matches('sensor.camera.frame', 'sensor.camera.frame')).toBe(true);
  });

  // --- Single wildcard * ---
  it('* matches exactly one segment: sensor.* matches sensor.camera', () => {
    expect(TopicMatcher.matches('sensor.*', 'sensor.camera')).toBe(true);
  });

  it('* does NOT match multiple segments: sensor.* does NOT match sensor.camera.frame', () => {
    expect(TopicMatcher.matches('sensor.*', 'sensor.camera.frame')).toBe(false);
  });

  it('* at beginning: *.camera matches sensor.camera', () => {
    expect(TopicMatcher.matches('*.camera', 'sensor.camera')).toBe(true);
  });

  it('* at beginning does NOT match multi-segment prefix: *.camera does NOT match device.sensor.camera', () => {
    expect(TopicMatcher.matches('*.camera', 'device.sensor.camera')).toBe(false);
  });

  it('* in the middle: sensor.*.frame matches sensor.camera.frame', () => {
    expect(TopicMatcher.matches('sensor.*.frame', 'sensor.camera.frame')).toBe(true);
  });

  it('* in the middle does NOT match when segment missing: sensor.*.frame does NOT match sensor.frame', () => {
    expect(TopicMatcher.matches('sensor.*.frame', 'sensor.frame')).toBe(false);
  });

  it('* alone matches single-segment topic', () => {
    expect(TopicMatcher.matches('*', 'sensor')).toBe(true);
  });

  it('* alone does NOT match multi-segment topic', () => {
    expect(TopicMatcher.matches('*', 'sensor.camera')).toBe(false);
  });

  // --- Multi-level wildcard ** ---
  it('** matches one segment: sensor.** matches sensor.camera', () => {
    expect(TopicMatcher.matches('sensor.**', 'sensor.camera')).toBe(true);
  });

  it('** matches multiple segments: sensor.** matches sensor.camera.frame', () => {
    expect(TopicMatcher.matches('sensor.**', 'sensor.camera.frame')).toBe(true);
  });

  it('** matches deeply nested: sensor.** matches sensor.camera.frame.data.raw', () => {
    expect(TopicMatcher.matches('sensor.**', 'sensor.camera.frame.data.raw')).toBe(true);
  });

  it('** must match at least one segment: sensor.** does NOT match sensor', () => {
    expect(TopicMatcher.matches('sensor.**', 'sensor')).toBe(false);
  });

  it('** alone matches everything (any single or multi-segment topic)', () => {
    expect(TopicMatcher.matches('**', 'sensor')).toBe(true);
    expect(TopicMatcher.matches('**', 'sensor.camera')).toBe(true);
    expect(TopicMatcher.matches('**', 'sensor.camera.frame')).toBe(true);
  });

  it('**.frame matches topics ending in .frame', () => {
    expect(TopicMatcher.matches('**.frame', 'sensor.camera.frame')).toBe(true);
    expect(TopicMatcher.matches('**.frame', 'camera.frame')).toBe(true);
  });

  it('**.frame does NOT match topics not ending in .frame', () => {
    expect(TopicMatcher.matches('**.frame', 'sensor.camera.data')).toBe(false);
  });

  // --- Edge cases ---
  it('empty strings: empty pattern matches empty topic', () => {
    expect(TopicMatcher.matches('', '')).toBe(true);
  });

  it('empty pattern does NOT match non-empty topic', () => {
    expect(TopicMatcher.matches('', 'sensor')).toBe(false);
  });

  it('non-empty pattern does NOT match empty topic', () => {
    expect(TopicMatcher.matches('sensor', '')).toBe(false);
  });

  // --- Non-matching patterns ---
  it('completely different topics do not match', () => {
    expect(TopicMatcher.matches('sensor.camera', 'motor.servo')).toBe(false);
  });

  it('wrong prefix with wildcard does not match', () => {
    expect(TopicMatcher.matches('sensor.*', 'motor.camera')).toBe(false);
  });

  it('wrong prefix with double wildcard does not match', () => {
    expect(TopicMatcher.matches('sensor.**', 'motor.camera.frame')).toBe(false);
  });
});
