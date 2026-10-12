import { CATEGORIES, PRIORITIES } from '../types';
import type { Category, Priority, Status, Task } from '../types';
import { isValidISODate, isValidTime } from './dates';

const KEY = 'voxtask.tasks.v1';
const BACKUP_KEY = 'voxtask.tasks.v1.backup';

export interface LoadResult {
  tasks: Task[];
  firstVisit: boolean;
  corrupted: boolean;
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const isCategory = (v: unknown): v is Category => typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);
const isPriority = (v: unknown): v is Priority => typeof v === 'string' && (PRIORITIES as readonly string[]).includes(v);
const isStatus = (v: unknown): v is Status => v === 'pending' || v === 'completed';

function toTask(x: unknown): Task | null {
  if (!isRecord(x)) return null;
  const { id, title, description, date, startTime, durationMinutes, category, priority, status, createdAt } = x;
  if (typeof id !== 'string' || !id) return null;
  if (typeof title !== 'string' || !title.trim()) return null;
  if (!isCategory(category) || !isPriority(priority) || !isStatus(status)) return null;

  const validDate = typeof date === 'string' && isValidISODate(date) ? date : undefined;
  return {
    id,
    title: title.trim(),
    description: typeof description === 'string' && description ? description : undefined,
    date: validDate,
    startTime: validDate && typeof startTime === 'string' && isValidTime(startTime) ? startTime : undefined,
    durationMinutes:
      typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) && durationMinutes > 0
        ? Math.round(durationMinutes)
        : undefined,
    category,
    priority,
    status,
    createdAt: typeof createdAt === 'string' ? createdAt : new Date().toISOString(),
  };
}

export function loadTasks(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return { tasks: [], firstVisit: true, corrupted: false };
  }
  if (raw === null) return { tasks: [], firstVisit: true, corrupted: false };

  const backup = (): void => {
    try {
      localStorage.setItem(BACKUP_KEY, raw ?? '');
    } catch {
      /* ignore */
    }
  };

  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('Stored data is not a list');
    const seen = new Set<string>();
    const tasks: Task[] = [];
    for (const item of data) {
      const t = toTask(item);
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        tasks.push(t);
      }
    }
    const corrupted = tasks.length < data.length;
    if (corrupted) backup();
    return { tasks, firstVisit: false, corrupted };
  } catch {
    backup();
    return { tasks: [], firstVisit: false, corrupted: true };
  }
}

export function saveTasks(tasks: Task[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
    return true;
  } catch {
    return false;
  }
}
