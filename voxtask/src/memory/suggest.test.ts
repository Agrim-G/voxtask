import { describe, expect, it } from 'vitest';
import { applySuggestion, buildSuggestions } from './suggest';
import { buildMemory } from './validate';
import { emptyInput } from '../lib/tasks';

const study = buildMemory({ content: 'I prefer studying before noon', category: 'Preference' });
const gym = buildMemory({ content: 'My gym session takes 90 minutes', category: 'Routine' });
const proj = buildMemory({ content: 'VoxTask is my personal productivity project', category: 'Project' });
const mems = [study, gym, proj];

describe('buildSuggestions', () => {
  it('suggests a timing note, never an exact time, for a vague preference', () => {
    const r = buildSuggestions({ ...emptyInput('2026-01-05'), title: 'Study reasoning' }, mems);
    expect(r.memories.map((m) => m.id)).toEqual([study.id]);
    expect(r.suggestions).toHaveLength(1);
    expect(r.suggestions[0].field).toBe('description');
    expect(r.suggestions.some((s) => s.field === 'startTime')).toBe(false);
  });

  it('suggests the duration a memory states', () => {
    const r = buildSuggestions({ ...emptyInput('2026-01-05'), title: 'Go to the gym' }, mems);
    expect(r.suggestions.find((s) => s.field === 'duration')?.value).toBe('90');
  });

  it('does not suggest when the task already has a value', () => {
    const r = buildSuggestions({ ...emptyInput('2026-01-05'), title: 'Gym', duration: '45' }, mems);
    expect(r.suggestions.some((s) => s.field === 'duration')).toBe(false);
  });

  it('returns nothing for unrelated tasks', () => {
    const r = buildSuggestions({ ...emptyInput(), title: 'Buy milk' }, mems);
    expect(r.memories).toHaveLength(0);
  });

  it('only suggests an exact start time when the memory states one', () => {
    const m = buildMemory({ content: 'My yoga class is at 6 PM', category: 'Routine' });
    const withDate = buildSuggestions({ ...emptyInput('2026-01-05'), title: 'Yoga' }, [m]);
    expect(withDate.suggestions.find((s) => s.field === 'startTime')?.value).toBe('18:00');
    const noDate = buildSuggestions({ ...emptyInput(''), title: 'Yoga' }, [m]);
    expect(noDate.suggestions.some((s) => s.field === 'startTime')).toBe(false);
  });

  it('applies a suggestion only through applySuggestion', () => {
    const input = { ...emptyInput('2026-01-05'), title: 'Study reasoning' };
    const s = buildSuggestions(input, mems).suggestions[0];
    const next = applySuggestion(input, s);
    expect(input.description).toBe('');
    expect(next.description).toContain('before noon');
    expect(buildSuggestions(next, mems).suggestions).toHaveLength(0);
  });
});
