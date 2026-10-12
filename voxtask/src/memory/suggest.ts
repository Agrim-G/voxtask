import type { Category } from '../types';
import { formatTime, minutesToTime } from '../lib/dates';
import type { Memory, MemorySuggestion, RetrievalResult, TaskFieldsForMemory } from './types';
import { tokens } from './text';

/* Deterministic keyword matching. It is not AI, semantic search or machine learning. */

const CATEGORY_TERMS: Record<Category, string[]> = {
  Study: ['study', 'learn', 'revise', 'exam', 'homework'],
  Work: ['work', 'meeting', 'email', 'client'],
  Health: ['gym', 'workout', 'exercise', 'run'],
  Errands: ['shop', 'grocery', 'buy'],
  Personal: [],
  Other: [],
};

const WINDOWS: Array<[RegExp, string]> = [
  [/\bbefore noon\b/i, 'before noon'],
  [/\bin the morning\b|\bmornings?\b/i, 'in the morning'],
  [/\bafternoons?\b/i, 'in the afternoon'],
  [/\bevenings?\b/i, 'in the evening'],
  [/\bat night\b|\bnights?\b/i, 'at night'],
];

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

export const EMPTY_RESULT: RetrievalResult = { memories: [], suggestions: [] };

function explicitStart(content: string): string | null {
  let m = content.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (m) {
    const h = Number(m[1]);
    const mi = m[2] ? Number(m[2]) : 0;
    if (h >= 1 && h <= 12 && mi < 60) {
      return minutesToTime(((h % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0)) * 60 + mi);
    }
  }
  m = content.match(/\bat\s+([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (m) return minutesToTime(Number(m[1]) * 60 + Number(m[2]));
  return null;
}

function explicitDuration(content: string): number | null {
  if (!/\b(takes?|lasts?|usually|typically|for)\b/i.test(content)) return null;
  const m = content.match(/\b(\d+(?:\.\d+)?|an?|one|two|three|four|five|six)\s*(hours?|hrs?|minutes?|mins?)\b/i);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const qty = raw in NUM ? NUM[raw] : Number(raw);
  const minutes = Math.round(qty * (m[2].toLowerCase().startsWith('h') ? 60 : 1));
  return minutes >= 1 && minutes <= 1440 ? minutes : null;
}

export function timingNote(phrase: string): string {
  return `Timing preference (from memory): ${phrase}`;
}

export function buildSuggestions(input: TaskFieldsForMemory, memories: Memory[]): RetrievalResult {
  const taskTokens = new Set([
    ...tokens(`${input.title} ${input.description}`),
    ...tokens(CATEGORY_TERMS[input.category].join(' ')),
  ]);
  if (taskTokens.size === 0) return EMPTY_RESULT;

  const scored = memories
    .map((m) => ({ m, score: m.keywords.filter((k) => taskTokens.has(k)).length }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (a.m.updatedAt < b.m.updatedAt ? 1 : -1));

  const suggestions: MemorySuggestion[] = [];
  for (const { m } of scored) {
    if (!input.duration.trim()) {
      const d = explicitDuration(m.content);
      if (d !== null) {
        suggestions.push({
          id: `${m.id}:duration:${d}`,
          memoryId: m.id,
          label: `Set duration to ${d} minutes, as stated in this memory`,
          field: 'duration',
          value: String(d),
        });
      }
    }
    if (!input.startTime) {
      const start = input.date ? explicitStart(m.content) : null;
      if (start) {
        suggestions.push({
          id: `${m.id}:startTime:${start}`,
          memoryId: m.id,
          label: `Start at ${formatTime(start)}, as stated in this memory`,
          field: 'startTime',
          value: start,
        });
      } else {
        const hit = WINDOWS.find(([re]) => re.test(m.content));
        if (hit) {
          const note = timingNote(hit[1]);
          if (!input.description.includes(note)) {
            suggestions.push({
              id: `${m.id}:description:${hit[1]}`,
              memoryId: m.id,
              label: `Add a note “${hit[1]}”. No exact time will be set`,
              field: 'description',
              value: note,
            });
          }
        }
      }
    }
  }
  return { memories: scored.map((s) => s.m), suggestions };
}

/** Returns a copy of `input` with the accepted suggestion applied. */
export function applySuggestion<T extends { description: string; startTime: string; duration: string }>(
  input: T,
  s: MemorySuggestion,
): T {
  if (s.field === 'description') {
    const joined = input.description.trim() ? `${input.description.trim()} · ${s.value}` : s.value;
    return { ...input, description: joined.slice(0, 300) };
  }
  return { ...input, [s.field]: s.value };
}
