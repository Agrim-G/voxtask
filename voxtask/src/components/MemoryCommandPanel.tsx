import { useState } from 'react';
import { Brain, Trash2, X } from 'lucide-react';
import type { Memory, MemoryInput } from '../memory/types';
import type { MemoryStore } from '../memory/useMemoryStore';
import { validateMemoryInput } from '../memory/validate';
import { MemoryFields } from './MemoryFields';

export type PanelState =
  | { kind: 'remember'; content: string; category: MemoryInput['category'] }
  | { kind: 'list'; memories: Memory[] }
  | { kind: 'forget'; query: string; matches: Memory[] }
  | { kind: 'message'; tone: 'info' | 'warn'; text: string };

interface Props {
  panel: PanelState;
  store: MemoryStore;
  onClose: () => void;
  onNotice: (msg: string) => void;
  onOpenCenter: () => void;
}

export function MemoryCommandPanel({ panel, store, onClose, onNotice, onOpenCenter }: Props) {
  const [draft, setDraft] = useState<MemoryInput>(
    panel.kind === 'remember' ? { content: panel.content, category: panel.category } : { content: '', category: 'Other' },
  );
  const [matches, setMatches] = useState<Memory[]>(panel.kind === 'forget' ? panel.matches : []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const problem = validateMemoryInput(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    const r = await store.add(draft);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onNotice('Memory saved.');
    onClose();
  };

  const forget = async (m: Memory) => {
    setBusy(true);
    const r = await store.remove(m.id);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onNotice('Memory deleted.');
    const left = matches.filter((x) => x.id !== m.id);
    setMatches(left);
    setError(null);
    if (left.length === 0) onClose();
  };

  const title =
    panel.kind === 'remember'
      ? 'Save this memory?'
      : panel.kind === 'list'
        ? 'What I remember'
        : panel.kind === 'forget'
          ? matches.length > 1
            ? 'Which memory should I forget?'
            : 'Forget this memory?'
          : 'Memory';

  return (
    <section aria-label="Memory command" className="card border-emerald-500/40 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-50">
          <Brain size={17} className="text-emerald-400" />
          {title}
        </h2>
        <button type="button" className="icon-btn -mr-1 -mt-1" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {panel.kind === 'remember' && (
        <>
          <p className="mb-3 text-sm text-zinc-400">
            Check the wording and category. Nothing is stored until you confirm. It stays in this browser only.
          </p>
          <MemoryFields value={draft} idPrefix="cmd" onChange={(next) => { setDraft(next); setError(null); }} />
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save memory'}
            </button>
          </div>
        </>
      )}

      {panel.kind === 'list' && (
        <>
          {panel.memories.length === 0 ? (
            <p className="text-sm text-zinc-400">I don’t have any saved memories yet. Try “Remember that I prefer studying before noon”.</p>
          ) : (
            <ul className="space-y-2">
              {panel.memories.map((m) => (
                <li key={m.id} className="break-words rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-zinc-200">
                  <span className="chip mr-2">{m.category}</span>
                  {m.content}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onOpenCenter}>
              Open Memory Center
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}

      {panel.kind === 'forget' && (
        <>
          <p className="mb-3 text-sm text-zinc-400">
            Nothing is deleted until you choose a memory below. Matches for “{panel.query}”:
          </p>
          <ul className="space-y-2">
            {matches.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
                <p className="min-w-0 break-words text-sm text-zinc-200">
                  <span className="chip mr-2">{m.category}</span>
                  {m.content}
                </p>
                <button type="button" className="btn-danger shrink-0 px-2.5 py-1 text-xs" onClick={() => forget(m)} disabled={busy}>
                  <Trash2 size={13} />
                  Delete
                </button>
              </li>
            ))}
          </ul>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          <div className="mt-4 flex justify-end">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </>
      )}

      {panel.kind === 'message' && (
        <p role="status" className={`text-sm ${panel.tone === 'warn' ? 'text-amber-300' : 'text-zinc-300'}`}>
          {panel.text}
        </p>
      )}
    </section>
  );
}
