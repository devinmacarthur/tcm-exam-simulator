import { describe, it, expect } from 'vitest';
import { formatClock, msRemaining, proportionalMinutes, pct, formatDuration } from '../src/lib/time.ts';

describe('timer helpers', () => {
  it('formats clocks', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(59_000)).toBe('00:59');
    expect(formatClock(150 * 60_000)).toBe('2:30:00');
    expect(formatClock(3_599_000)).toBe('59:59');
  });
  it('computes remaining time and never goes negative', () => {
    const now = Date.parse('2026-10-19T10:00:00Z');
    expect(msRemaining('2026-10-19T12:30:00Z', now)).toBe(150 * 60_000);
    expect(msRemaining('2026-10-19T09:00:00Z', now)).toBe(0);
    expect(msRemaining(null, now)).toBeNull();
  });
  it('scales time proportionally to the official 1.5 min per item', () => {
    expect(proportionalMinutes(100, 100, 150)).toBe(150);
    expect(proportionalMinutes(50, 100, 150)).toBe(75);
    expect(proportionalMinutes(1, 100, 150)).toBe(2);
  });
  it('formats percentages and durations', () => {
    expect(pct(0.756)).toBe('76%');
    expect(pct(null)).toBe('—');
    expect(formatDuration(90_000)).toBe('1m 30s');
    expect(formatDuration(3_600_000)).toBe('1h 0m');
  });
});
