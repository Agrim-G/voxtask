import { newId } from '../lib/tasks';
import { MEMORY_CATEGORIES } from './types';
import type { ImportReport, Memory, MemoryCategory, MemoryInput } from './types';
import { extractKeywords, normalizeContent } from './text';

export const MAX_CONTENT = 300;
export const MAX_IMPORT_ITEMS = 1000;
export const EXPORT_APP = 'voxtask-memory';

const SECRET_PATTERNS: RegExp[] = [
  /\b(password|passcode|passwd|pwd|secret key|api[\s_-]?key|access token|auth token|bearer token|private key|seed phrase|recovery phrase|cvv|otp)\b/i,
  /\bpin\b\s*(?:is|:|=)/i,
  /\b(?:sk|pk|ghp|gho|xox[abp])[-_][A-Za-z0-9_-]{16,}/,
  /(?:\d[ -]?){13,19}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b[A-Za-z0-9+/_-]{32,}\b/,
];

export function looksSecret(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text));
}

export const SECRET_MESSAGE = "That looks like a password, key or other secret. VoxTask won't store those as memories.";

export const isMemoryCategory = (v: unknown): v is MemoryCategory =>
  typeof v === 'string' && (MEMORY_CATEGORIES as readonly string[]).includes(v);

export function validateMemoryInput(input: MemoryInput): string | null {
  const content = input.content.trim();
  if (!content) return 'Write what you want VoxTask to remember.';
  if (content.split(/\s+/).length < 2) return 'Add a little more detail (at least two words) so the memory is useful.';
  if (content.length > MAX_CONTENT) return `Keep memories to ${MAX_CONTENT} characters or fewer.`;
  if (looksSecret(content)) return SECRET_MESSAGE;
  if (!isMemoryCategory(input.category)) return 'Choose a category.';
  return null;
}

export function buildMemory(input: MemoryInput, existing?: Memory): Memory {
  const now = new Date().toISOString();
  const content = input.content.trim();
  return {
    id: existing?.id ?? newId(),
    content,
    category: input.category,
    keywords: extractKeywords(content),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    source: 'manual',
  };
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Validates an unknown record (from IndexedDB or an import). Returns null if unusable. */
export function toMemory(x: unknown, opts: { requireId: boolean }): Memory | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
  const r = x as Record<string, unknown>;
  if (typeof r.content !== 'string') return null;
  const content = r.content.trim();
  if (!content || content.length > MAX_CONTENT || looksSecret(content)) return null;
  if (!isMemoryCategory(r.category)) return null;
  if (r.source !== undefined && r.source !== 'manual') return null;

  let id: string;
  if (typeof r.id === 'string' && r.id.trim() && r.id.length <= 100) id = r.id;
  else if (opts.requireId) return null;
  else id = newId();

  const now = new Date().toISOString();
  const createdAt = r.createdAt === undefined ? now : isoOrNull(r.createdAt);
  const updatedAt = r.updatedAt === undefined ? createdAt : isoOrNull(r.updatedAt);
  if (!createdAt || !updatedAt) return null;

  const kw =
    Array.isArray(r.keywords) && r.keywords.every((k) => typeof k === 'string')
      ? (r.keywords as string[]).map((k) => k.toLowerCase().slice(0, 40)).slice(0, 12)
      : extractKeywords(content);

  return { id, content, category: r.category, keywords: kw, createdAt, updatedAt, source: 'manual' };
}

export function buildExport(memories: Memory[]): string {
  return JSON.stringify(
    { app: EXPORT_APP, version: 1, exportedAt: new Date().toISOString(), memories },
    null,
    2,
  );
}

export type ImportOutcome =
  | { ok: true; toAdd: Memory[]; report: ImportReport }
  | { ok: false; error: string };

/** Parses and validates a JSON backup. Existing ids and identical text are skipped as duplicates. */
export function parseImport(text: string, existing: Memory[]): ImportOutcome {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  let items: unknown;
  if (Array.isArray(data)) items = data;
  else if (typeof data === 'object' && data !== null && (data as Record<string, unknown>).app === EXPORT_APP) {
    items = (data as Record<string, unknown>).memories;
  }
  if (!Array.isArray(items)) {
    return { ok: false, error: 'This does not look like a VoxTask memory backup.' };
  }
  if (items.length > MAX_IMPORT_ITEMS) {
    return { ok: false, error: `Backups can contain at most ${MAX_IMPORT_ITEMS} memories.` };
  }

  const ids = new Set(existing.map((m) => m.id));
  const texts = new Set(existing.map((m) => normalizeContent(m.content)));
  const toAdd: Memory[] = [];
  let duplicates = 0;
  let invalid = 0;

  for (const item of items) {
    const m = toMemory(item, { requireId: false });
    if (!m) {
      invalid++;
      continue;
    }
    const norm = normalizeContent(m.content);
    if (ids.has(m.id) || texts.has(norm)) {
      duplicates++;
      continue;
    }
    ids.add(m.id);
    texts.add(norm);
    toAdd.push(m);
  }
  return { ok: true, toAdd, report: { total: items.length, added: toAdd.length, duplicates, invalid } };
}
