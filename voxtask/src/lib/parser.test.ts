import { describe, expect, it } from 'vitest';
import { parseTasks } from './parser';

describe('existing task parser (regression)', () => {
  it('still splits the example sentence into three tasks', () => {
    const now = new Date(2026, 0, 5, 10, 0);
    const r = parseTasks(
      'Tomorrow I need to study quantitative aptitude from 9 to 11, go to the gym at 6 PM for an hour, and buy groceries after lunch.',
      now,
    );
    expect(r.map((t) => [t.title, t.date, t.startTime, t.duration])).toEqual([
      ['Study quantitative aptitude', '2026-01-06', '09:00', '120'],
      ['Go to the gym', '2026-01-06', '18:00', '60'],
      ['Buy groceries', '2026-01-06', '', ''],
    ]);
    expect(r[2].description).toBe('Timing: after lunch');
  });
});
