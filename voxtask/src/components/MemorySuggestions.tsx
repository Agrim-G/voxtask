import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import type { TaskInput } from '../types';
import type { RetrievalResult } from '../memory/types';
import { applySuggestion, EMPTY_RESULT } from '../memory/suggest';

interface Props {
  input: TaskInput;
  enabled: boolean;
  skip: boolean;
  onSkipChange: (skip: boolean) => void;
  retrieve: (input: TaskInput) => Promise<RetrievalResult>;
  onChange: (next: TaskInput) => void;
}

/** Shows relevant memories and optional suggestions. Nothing is applied until the user accepts. */
export function MemorySuggestions({ input, enabled, skip, onSkipChange, retrieve, onChange }: Props) {
  const [result, setResult] = useState<RetrievalResult>(EMPTY_RESULT);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled || skip || input.title.trim().length < 2) {
      setResult(EMPTY_RESULT);
      setError(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      retrieve(input)
        .then((r) => {
          if (cancelled) return;
          setResult(r);
          setError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setResult(EMPTY_RESULT);
          setError('Memory could not be read right now, so no suggestions are shown.');
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, skip, retrieve, input.title, input.description, input.category, input.date, input.startTime, input.duration]);

  if (!enabled) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-300">
        <Brain size={13} className="shrink-0" />
        Memory is off, so no memory suggestions are shown.
      </p>
    );
  }

  if (skip) {
    return (
      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
        <Brain size={13} className="shrink-0" />
        Memory is not used for this task.
        <button type="button" className="text-emerald-400 underline hover:text-emerald-300" onClick={() => onSkipChange(false)}>
          Use memory
        </button>
      </p>
    );
  }

  if (error) {
    return (
      <p role="status" className="mt-3 flex items-center gap-1.5 text-xs text-amber-300">
        <Brain size={13} className="shrink-0" />
        {error}
      </p>
    );
  }

  if (result.memories.length === 0) return null;

  const visible = result.suggestions.filter((s) => !dismissed.includes(s.id));

  return (
    <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-semibold text-emerald-300">
          <Brain size={13} />
          From your memory
          <span className="font-normal text-zinc-500">· matched by keywords, not AI</span>
        </p>
        <button type="button" className="text-zinc-400 underline hover:text-zinc-200" onClick={() => onSkipChange(true)}>
          Don’t use memory for this task
        </button>
      </div>

      <ul className="mt-2 space-y-1 text-zinc-300">
        {result.memories.slice(0, 3).map((m) => (
          <li key={m.id} className="break-words">
            <span className="chip mr-1.5">{m.category}</span>
            {m.content}
          </li>
        ))}
      </ul>

      {visible.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-emerald-500/20 pt-3">
          {visible.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-zinc-200">{s.label}</span>
              <span className="flex gap-1.5">
                <button type="button" className="btn-primary px-2.5 py-1 text-xs" onClick={() => onChange(applySuggestion(input, s))}>
                  Accept
                </button>
                <button
                  type="button"
                  className="btn-secondary px-2.5 py-1 text-xs"
                  onClick={() => setDismissed((prev) => [...prev, s.id])}
                >
                  Dismiss
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
