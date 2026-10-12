import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AlertTriangle, Brain, Download, Info, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { MEMORY_CATEGORIES } from '../memory/types';
import type { Memory, MemoryCategory, MemoryInput } from '../memory/types';
import type { MemoryStore } from '../memory/useMemoryStore';
import { validateMemoryInput } from '../memory/validate';
import { ConfirmDialog } from './ConfirmDialog';
import { MemoryFields } from './MemoryFields';
import { Modal } from './Modal';
import { EmptyState } from './ui';

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

type Editing = { mode: 'create' } | { mode: 'edit'; memory: Memory } | null;
type Confirm = { kind: 'delete'; memory: Memory } | { kind: 'clear' } | null;
type Message = { tone: 'success' | 'error'; text: string } | null;

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MemoryModal({
  heading,
  initial,
  onSave,
  onClose,
}: {
  heading: string;
  initial: MemoryInput;
  onSave: (v: MemoryInput) => Promise<string | null>;
  onClose: () => void;
}) {
  const [value, setValue] = useState<MemoryInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateMemoryInput(value);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    const failure = await onSave(value);
    setBusy(false);
    if (failure) setError(failure);
  };

  return (
    <Modal title={heading} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <MemoryFields value={value} idPrefix="memmodal" autoFocus onChange={(n) => { setValue(n); setError(null); }} />
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save memory'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function MemoryCenter({ store }: { store: MemoryStore }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | MemoryCategory>('all');
  const [editing, setEditing] = useState<Editing>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const usable = store.status === 'ready';

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.memories.filter(
      (m) =>
        (category === 'all' || m.category === category) &&
        (!q || m.content.toLowerCase().includes(q) || m.keywords.some((k) => k.includes(q))),
    );
  }, [store.memories, query, category]);

  const saveEditing = async (input: MemoryInput): Promise<string | null> => {
    if (!editing) return null;
    const r = editing.mode === 'edit' ? await store.update(editing.memory.id, input) : await store.add(input);
    if (!r.ok) return r.error;
    setMessage({ tone: 'success', text: editing.mode === 'edit' ? 'Memory updated.' : 'Memory saved.' });
    setEditing(null);
    return null;
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    const r = confirm.kind === 'delete' ? await store.remove(confirm.memory.id) : await store.removeAll();
    setBusy(false);
    setConfirm(null);
    setMessage(
      r.ok
        ? { tone: 'success', text: confirm.kind === 'delete' ? 'Memory deleted.' : 'All memories cleared.' }
        : { tone: 'error', text: r.error },
    );
  };

  const doExport = async () => {
    setBusy(true);
    const r = await store.exportJson();
    setBusy(false);
    if (!r.ok) {
      setMessage({ tone: 'error', text: r.error });
      return;
    }
    downloadText(`voxtask-memories-${new Date().toISOString().slice(0, 10)}.json`, r.value);
    setMessage({ tone: 'success', text: 'Backup downloaded.' });
  };

  const doImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage({ tone: 'error', text: 'That file is too large (2 MB maximum).' });
      return;
    }
    setBusy(true);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setBusy(false);
      setMessage({ tone: 'error', text: 'The file could not be read.' });
      return;
    }
    const r = await store.importJson(text);
    setBusy(false);
    if (!r.ok) {
      setMessage({ tone: 'error', text: r.error });
      return;
    }
    const { added, duplicates, invalid } = r.value;
    setMessage({
      tone: 'success',
      text: `Imported ${added} new ${added === 1 ? 'memory' : 'memories'}. Skipped ${duplicates} duplicate${duplicates === 1 ? '' : 's'} and ${invalid} invalid record${invalid === 1 ? '' : 's'}.`,
    });
  };

  const toggle = () => {
    const next = !store.enabled;
    if (!store.setEnabled(next)) {
      setMessage({ tone: 'error', text: 'Could not save this setting in your browser.' });
      return;
    }
    setMessage({ tone: 'success', text: next ? 'Memory is on.' : 'Memory is off. Saved memories are kept but not used.' });
  };

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-50">
            <Brain size={18} className="text-emerald-400" />
            Memory Center
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Facts you chose to save, such as preferences and routines. VoxTask only uses what you confirmed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span id="memory-switch-label" className="text-sm text-zinc-300">
            Use memory
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={store.enabled}
            aria-labelledby="memory-switch-label"
            onClick={toggle}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
              store.enabled ? 'border-emerald-500 bg-emerald-500' : 'border-ink-600 bg-ink-700'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${store.enabled ? 'left-[22px]' : 'left-0.5'}`}
            />
          </button>
        </div>
      </div>

      {!store.enabled && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          Memory is off. Your saved memories are kept, but they are not used for suggestions or commands.
        </p>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-xs text-zinc-400">
        <Info size={14} className="mt-0.5 shrink-0" />
        <p>
          Memories are stored locally in this browser (IndexedDB) and are not synced between devices. They are not encrypted and are
          never sent anywhere by VoxTask, but they can be lost if you clear this site’s data, so export a backup now and then. Don’t save
          passwords or other secrets. Voice dictation is handled by your browser and may use an online speech service.
        </p>
      </div>

      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.tone === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {message.text}
        </p>
      )}

      {store.status === 'loading' && <p className="text-sm text-zinc-400">Loading memories…</p>}

      {store.status === 'error' && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <p>{store.error ?? 'Memories could not be loaded.'}</p>
          <p className="mt-1 text-red-300/80">Your tasks are not affected.</p>
          <button type="button" className="btn-secondary mt-3" onClick={() => void store.retry()}>
            Try again
          </button>
        </div>
      )}

      {usable && store.skipped > 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {store.skipped} stored record{store.skipped === 1 ? ' was' : 's were'} unreadable and ignored.
        </p>
      )}

      {usable && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <label className="label" htmlFor="memory-search">
                Search
              </label>
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  id="memory-search"
                  className="input pl-9"
                  placeholder="Search memories"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="w-44">
              <label className="label" htmlFor="memory-category">
                Category
              </label>
              <select
                id="memory-category"
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value as 'all' | MemoryCategory)}
              >
                <option value="all">All categories</option>
                {MEMORY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => setEditing({ mode: 'create' })} disabled={busy}>
              <Plus size={16} />
              New memory
            </button>
            <button type="button" className="btn-secondary" onClick={doExport} disabled={busy || store.memories.length === 0}>
              <Download size={15} />
              Export JSON
            </button>
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload size={15} />
              Import JSON
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Import memories from a JSON file" onChange={doImport} />
            <button
              type="button"
              className="btn-ghost text-red-300 hover:text-red-200"
              onClick={() => setConfirm({ kind: 'clear' })}
              disabled={busy || store.memories.length === 0}
            >
              <Trash2 size={15} />
              Clear all
            </button>
          </div>

          {store.memories.length === 0 ? (
            <EmptyState
              icon={Brain}
              title="No memories yet"
              text="Say or type “Remember that I prefer studying before noon”, or create one with New memory."
            />
          ) : shown.length === 0 ? (
            <EmptyState icon={Search} title="No memories match" text="Try a different search or category." />
          ) : (
            <ul className="space-y-2" aria-label="Saved memories">
              {shown.map((m) => (
                <li key={m.id} className="card flex items-start gap-3 p-3.5 transition-colors hover:border-zinc-600">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-zinc-100">{m.content}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="chip border-emerald-500/30 text-emerald-300">{m.category}</span>
                      {m.keywords.slice(0, 6).map((k) => (
                        <span key={k} className="chip text-zinc-500">
                          {k}
                        </span>
                      ))}
                      <span className="text-xs text-zinc-500">Updated {new Date(m.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <button type="button" className="icon-btn" aria-label={`Edit memory: ${m.content}`} onClick={() => setEditing({ mode: 'edit', memory: m })}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="icon-btn hover:text-red-300" aria-label={`Delete memory: ${m.content}`} onClick={() => setConfirm({ kind: 'delete', memory: m })}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {editing && (
        <MemoryModal
          key={editing.mode === 'edit' ? editing.memory.id : 'new'}
          heading={editing.mode === 'edit' ? 'Edit memory' : 'New memory'}
          initial={
            editing.mode === 'edit'
              ? { content: editing.memory.content, category: editing.memory.category }
              : { content: '', category: 'Other' }
          }
          onSave={saveEditing}
          onClose={() => setEditing(null)}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'delete' ? 'Delete this memory?' : 'Clear all memories?'}
          message={
            confirm.kind === 'delete'
              ? `“${confirm.memory.content}” will be permanently removed from this browser.`
              : `All ${store.memories.length} saved memories will be permanently removed from this browser. Export a backup first if you might want them back.`
          }
          confirmLabel={confirm.kind === 'delete' ? 'Delete' : 'Clear all'}
          onConfirm={() => void runConfirm()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
