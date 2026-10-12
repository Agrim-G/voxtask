import type { TaskInput } from '../types';

export const MEMORY_CATEGORIES = ['Preference', 'Routine', 'Goal', 'Project', 'Other'] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

/** A user-confirmed memory. `source` is always 'manual' in this version. */
export interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  keywords: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  source: 'manual';
}

export interface MemoryInput {
  content: string;
  category: MemoryCategory;
}

export interface ImportReport {
  total: number;
  added: number;
  duplicates: number;
  invalid: number;
}

export interface MemorySuggestion {
  id: string;
  memoryId: string;
  label: string;
  field: 'duration' | 'startTime' | 'description';
  value: string;
}

export interface RetrievalResult {
  memories: Memory[];
  suggestions: MemorySuggestion[];
}

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

export type TaskFieldsForMemory = Pick<TaskInput, 'title' | 'description' | 'category' | 'date' | 'startTime' | 'duration'>;
