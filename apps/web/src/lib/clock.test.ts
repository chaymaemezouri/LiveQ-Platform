import { describe, expect, it } from 'vitest';
import { formatClock, remainingSeconds } from '@/lib/clock';

describe('countdown clock', () => {
  it('counts down to zero and prints minutes', () => {
    const closesAt = '2026-11-01T09:00:30.000Z';
    const now = new Date('2026-11-01T09:00:00.000Z').getTime();
    expect(remainingSeconds(closesAt, now)).toBe(30);
    expect(remainingSeconds(closesAt, now + 30_000)).toBe(0);
    expect(remainingSeconds(null, now)).toBeNull();
    expect(formatClock(75)).toBe('1:15');
  });
});
