import type { Task, TaskInput } from '../types';
import { addDays, isValidISODate, isValidTime, timeToMinutes, todayISO } from './dates';

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyInput(date = ''): TaskInput {
  return { title: '', description: '', date, startTime: '', duration: '', category: 'Other', priority: 'medium' };
}

export function taskToInput(t: Task): TaskInput {
  return {
    title: t.title,
    description: t.description ?? '',
    date: t.date ?? '',
    startTime: t.startTime ?? '',
    duration: t.durationMinutes ? String(t.durationMinutes) : '',
    category: t.category,
    priority: t.priority,
  };
}

export function validateInput(v: TaskInput): string | null {
  const title = v.title.trim();
  if (!title) return 'Title is required.';
  if (title.length > 140) return 'Title must be 140 characters or fewer.';
  if (v.date && !isValidISODate(v.date)) return 'Date is not valid.';
  if (v.startTime && !isValidTime(v.startTime)) return 'Time is not valid.';
  if (v.startTime && !v.date) return 'Pick a date to go with the start time.';
  if (v.duration.trim()) {
    const n = Number(v.duration);
    if (!Number.isInteger(n) || n < 1 || n > 1440) return 'Duration must be a whole number of minutes (1–1440).';
  }
  return null;
}

export function inputToTask(v: TaskInput, existing?: Task): Task {
  return {
    id: existing?.id ?? newId(),
    title: v.title.trim(),
    description: v.description.trim() || undefined,
    date: v.date || undefined,
    startTime: v.startTime || undefined,
    durationMinutes: v.duration.trim() ? Number(v.duration) : undefined,
    category: v.category,
    priority: v.priority,
    status: existing?.status ?? 'pending',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}

/** Sorts by date (undated last), then time (untimed last), then creation time. */
export function compareTasks(a: Task, b: Task): number {
  const ad = a.date ?? '9999-99-99';
  const bd = b.date ?? '9999-99-99';
  if (ad !== bd) return ad < bd ? -1 : 1;
  const at = a.startTime ?? '99:99';
  const bt = b.startTime ?? '99:99';
  if (at !== bt) return at < bt ? -1 : 1;
  if (a.createdAt === b.createdAt) return 0;
  return a.createdAt < b.createdAt ? -1 : 1;
}

function span(t: Task): { s: number; e: number } | null {
  if (!t.startTime) return null;
  const s = timeToMinutes(t.startTime);
  return { s, e: s + (t.durationMinutes ?? 0) };
}

/** Map of task id -> titles of pending tasks it overlaps with (same day, both timed). */
export function overlapMap(tasks: Task[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const timed = tasks.filter((t) => t.status === 'pending' && t.date && t.startTime);
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (a.date !== b.date) continue;
      const sa = span(a);
      const sb = span(b);
      if (!sa || !sb) continue;
      if (sa.s === sb.s || (sa.s < sb.e && sb.s < sa.e)) {
        map.set(a.id, [...(map.get(a.id) ?? []), b.title]);
        map.set(b.id, [...(map.get(b.id) ?? []), a.title]);
      }
    }
  }
  return map;
}

export function sampleTasks(): Task[] {
  const today = todayISO();
  const make = (title: string, extra: Partial<Task>): Task => ({
    id: newId(),
    title,
    category: 'Other',
    priority: 'medium',
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...extra,
  });
  return [
    make('Morning walk', { date: today, startTime: '07:00', durationMinutes: 30, category: 'Health', priority: 'low', status: 'completed' }),
    make('Study quantitative aptitude', { date: today, startTime: '09:00', durationMinutes: 120, category: 'Study', priority: 'high' }),
    make('Reply to client email', { date: today, startTime: '14:00', durationMinutes: 30, category: 'Work' }),
    make('Gym session', { date: today, startTime: '18:00', durationMinutes: 60, category: 'Health' }),
    make('Buy groceries', { date: addDays(today, 1), category: 'Errands', description: 'Timing: after lunch' }),
    make('Plan weekend trip', { date: addDays(today, 3), category: 'Personal', priority: 'low' }),
    make('Submit scholarship form', { date: addDays(today, -1), category: 'Personal', priority: 'high' }),
  ];
}
