import { Trash2 } from 'lucide-react';
import type { Draft, TaskInput } from '../types';
import { validateInput } from '../lib/tasks';
import type { RetrievalResult } from '../memory/types';
import { MemorySuggestions } from './MemorySuggestions';
import { TaskFields } from './TaskFields';

interface Props {
  drafts: Draft[];
  onChange: (drafts: Draft[]) => void;
  onConfirm: () => void;
  onDiscard: () => void;
  memoryEnabled: boolean;
  retrieve: (input: TaskInput) => Promise<RetrievalResult>;
}

export function ReviewPanel({ drafts, onChange, onConfirm, onDiscard, memoryEnabled, retrieve }: Props) {
  const validCount = drafts.filter((d) => validateInput(d) === null).length;
  const invalidCount = drafts.length - validCount;

  const update = (key: string, next: TaskInput) =>
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...next } : d)));
  const setSkip = (key: string, skipMemory: boolean) =>
    onChange(drafts.map((d) => (d.key === key ? { ...d, skipMemory } : d)));
  const remove = (key: string) => onChange(drafts.filter((d) => d.key !== key));

  return (
    <section aria-label="Review parsed tasks" className="card border-emerald-500/40 p-5">
      <h2 className="text-base font-semibold text-zinc-50">Review before saving</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Parsed with simple rules, so check every field. Nothing is saved until you confirm.
      </p>

      <div className="mt-4 space-y-4">
        {drafts.map((d, i) => {
          const problem = validateInput(d);
          return (
            <div key={d.key} className="rounded-xl border border-ink-700 bg-ink-850 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Task {i + 1}</p>
                  <p className="mt-0.5 break-words text-xs text-zinc-500">From: “{d.source}”</p>
                </div>
                <button
                  type="button"
                  className="icon-btn shrink-0 hover:text-red-300"
                  aria-label={`Remove proposed task ${i + 1}`}
                  onClick={() => remove(d.key)}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {d.notes.length > 0 && (
                <ul className="mb-3 list-disc space-y-0.5 rounded-lg bg-amber-500/10 py-2 pl-7 pr-3 text-xs text-amber-200">
                  {d.notes.map((n, idx) => (
                    <li key={idx}>{n}</li>
                  ))}
                </ul>
              )}

              <TaskFields value={d} idPrefix={`draft-${d.key}`} onChange={(next) => update(d.key, next)} />
              <MemorySuggestions
                input={d}
                enabled={memoryEnabled}
                skip={d.skipMemory === true}
                onSkipChange={(s) => setSkip(d.key, s)}
                retrieve={retrieve}
                onChange={(next) => update(d.key, next)}
              />

              {problem && (
                <p role="alert" className="mt-3 text-sm text-red-300">
                  {problem}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {invalidCount > 0
            ? `${invalidCount} task${invalidCount === 1 ? '' : 's'} need fixes and will stay here.`
            : 'All tasks look valid.'}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={onDiscard}>
            Discard all
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={validCount === 0}>
            Save {validCount} task{validCount === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </section>
  );
}
