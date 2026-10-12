import { useCallback, useEffect, useRef, useState } from 'react';
import type { TaskInput } from '../types';
import {
  clearMemories,
  deleteMemory,
  getAllMemories,
  MemoryStorageError,
  putMemories,
  putMemory,
} from './db';
import type { ImportReport, Memory, MemoryInput, Result, RetrievalResult } from './types';
import { buildExport, buildMemory, parseImport, validateMemoryInput } from './validate';
import { normalizeContent } from './text';
import { buildSuggestions, EMPTY_RESULT } from './suggest';
import { findForgetMatches } from './commands';

const ENABLED_KEY = 'voxtask.memory.enabled';

function readEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeEnabled(v: boolean): boolean {
  try {
    localStorage.setItem(ENABLED_KEY, String(v));
    return localStorage.getItem(ENABLED_KEY) === String(v);
  } catch {
    return false;
  }
}

const messageOf = (e: unknown): string =>
  e instanceof MemoryStorageError ? e.message : 'Something went wrong while using browser storage.';

const sortMemories = (list: Memory[]): Memory[] =>
  [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));

export type MemoryStatus = 'loading' | 'ready' | 'error';

export function useMemoryStore() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [status, setStatus] = useState<MemoryStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [enabled, setEnabledState] = useState<boolean>(readEnabled);
  const mounted = useRef(true);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const r = await getAllMemories();
      if (!mounted.current) return;
      setMemories(sortMemories(r.memories));
      setSkipped(r.skipped);
      setStatus('ready');
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setStatus('error');
      setError(messageOf(e));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const retry = useCallback(async () => {
    setStatus('loading');
    await refresh();
  }, [refresh]);

  const add = useCallback(async (input: MemoryInput): Promise<Result<Memory>> => {
    const problem = validateMemoryInput(input);
    if (problem) return { ok: false, error: problem };
    try {
      const existing = await getAllMemories();
      const norm = normalizeContent(input.content);
      if (existing.memories.some((m) => normalizeContent(m.content) === norm)) {
        return { ok: false, error: 'You already saved this memory.' };
      }
      const memory = buildMemory(input);
      await putMemory(memory);
      if (mounted.current) {
        setMemories(sortMemories([...existing.memories, memory]));
        setStatus('ready');
        setError(null);
      }
      return { ok: true, value: memory };
    } catch (e) {
      return { ok: false, error: messageOf(e) };
    }
  }, []);

  const update = useCallback(async (id: string, input: MemoryInput): Promise<Result<Memory>> => {
    const problem = validateMemoryInput(input);
    if (problem) return { ok: false, error: problem };
    try {
      const all = await getAllMemories();
      const current = all.memories.find((m) => m.id === id);
      if (!current) return { ok: false, error: 'That memory no longer exists.' };
      const norm = normalizeContent(input.content);
      if (all.memories.some((m) => m.id !== id && normalizeContent(m.content) === norm)) {
        return { ok: false, error: 'Another memory already says the same thing.' };
      }
      const next = buildMemory(input, current);
      await putMemory(next);
      if (mounted.current) setMemories(sortMemories(all.memories.map((m) => (m.id === id ? next : m))));
      return { ok: true, value: next };
    } catch (e) {
      return { ok: false, error: messageOf(e) };
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<Result> => {
    try {
      await deleteMemory(id);
      if (mounted.current) setMemories((prev) => prev.filter((m) => m.id !== id));
      return { ok: true, value: undefined };
    } catch (e) {
      return { ok: false, error: messageOf(e) };
    }
  }, []);

  const removeAll = useCallback(async (): Promise<Result> => {
    try {
      await clearMemories();
      if (mounted.current) {
        setMemories([]);
        setSkipped(0);
      }
      return { ok: true, value: undefined };
    } catch (e) {
      return { ok: false, error: messageOf(e) };
    }
  }, []);

  const exportJson = useCallback(async (): Promise<Result<string>> => {
    try {
      const all = await getAllMemories();
      return { ok: true, value: buildExport(sortMemories(all.memories)) };
    } catch (e) {
      return { ok: false, error: messageOf(e) };
    }
  }, []);

  const importJson = useCallback(async (text: string): Promise<Result<ImportReport>> => {
    try {
      const all = await getAllMemories();
      const outcome = parseImport(text, all.memories);
      if (!outcome.ok) return { ok: false, error: outcome.error };
      if (outcome.toAdd.length > 0) {
        await putMemories(outcome.toAdd);
        if (mounted.current) setMemories(sortMemories([...all.memories, ...outcome.toAdd]));
      }
      return { ok: true, value: outcome.report };
    } catch (e) {
      return { ok: false, error: messageOf(e) };
    }
  }, []);

  /** Fresh read for explicit commands ("what do you remember"). Callers must check `enabled` first. */
  const listFresh = useCallback(async (): Promise<Result<Memory[]>> => {
    try {
      const all = await getAllMemories();
      return { ok: true, value: sortMemories(all.memories) };
    } catch (e) {
      return { ok: false, error: messageOf(e) };
    }
  }, []);

  const findForForget = useCallback(async (query: string): Promise<Result<Memory[]>> => {
    try {
      const all = await getAllMemories();
      return { ok: true, value: findForgetMatches(query, all.memories) };
    } catch (e) {
      return { ok: false, error: messageOf(e) };
    }
  }, []);

  /** Relevant memories and suggestions for a task. Returns nothing while memory is off. */
  const retrieve = useCallback(
    async (input: TaskInput): Promise<RetrievalResult> => {
      if (!enabled) return EMPTY_RESULT;
      const all = await getAllMemories();
      return buildSuggestions(input, all.memories);
    },
    [enabled],
  );

  const setEnabled = useCallback((value: boolean): boolean => {
    if (!writeEnabled(value)) return false;
    setEnabledState(value);
    return true;
  }, []);

  return {
    memories,
    status,
    error,
    skipped,
    enabled,
    retry,
    add,
    update,
    remove,
    removeAll,
    exportJson,
    importJson,
    listFresh,
    findForForget,
    retrieve,
    setEnabled,
  };
}

export type MemoryStore = ReturnType<typeof useMemoryStore>;
