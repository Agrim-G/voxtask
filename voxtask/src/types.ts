export const CATEGORIES = ['Study', 'Work', 'Health', 'Personal', 'Errands', 'Other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export type Status = 'pending' | 'completed';
export type View = 'today' | 'upcoming' | 'all' | 'completed' | 'schedule' | 'memory';

/** Persisted task. `date` is a local YYYY-MM-DD string, `startTime` is HH:mm (24h). */
export interface Task {
  id: string;
  title: string;
  description?: string;
  date?: string;
  startTime?: string;
  durationMinutes?: number;
  category: Category;
  priority: Priority;
  status: Status;
  createdAt: string; // ISO timestamp
}

/** Form values (all strings so they bind directly to inputs). */
export interface TaskInput {
  title: string;
  description: string;
  date: string;
  startTime: string;
  duration: string; // minutes, or ''
  category: Category;
  priority: Priority;
}

export interface ParsedTask extends TaskInput {
  notes: string[];
  source: string;
}

export interface Draft extends ParsedTask {
  key: string;
  /** True when the user asked not to use memory for this task. */
  skipMemory?: boolean;
}
