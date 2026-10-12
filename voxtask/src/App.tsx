import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  CalendarDays,
  CheckCheck,
  Inbox,
  Info,
  LayoutDashboard,
  ListTodo,
  Mic,
  Plus,
  Trash2,
  X,
  Brain,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CATEGORIES, PRIORITIES } from './types';
import type { Category, Draft, Status, Task, TaskInput, View } from './types';
import { formatDateLong, formatDateShort, todayISO } from './lib/dates';
import { parseTasks } from './lib/parser';
import { loadTasks, saveTasks } from './lib/storage';
import {
  compareTasks,
  emptyInput,
  inputToTask,
  newId,
  overlapMap,
  sampleTasks,
  taskToInput,
  validateInput,
} from './lib/tasks';
import { CaptureCard } from './components/CaptureCard';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ReviewPanel } from './components/ReviewPanel';
import { Schedule } from './components/Schedule';
import { TaskItem } from './components/TaskItem';
import { TaskModal } from './components/TaskModal';
import { EmptyState, Section, StatCard } from './components/ui';
import { MemoryCenter } from './components/MemoryCenter';
import { MemoryCommandPanel } from './components/MemoryCommandPanel';
import type { PanelState } from './components/MemoryCommandPanel';
import { parseMemoryCommand } from './memory/commands';
import { useMemoryStore } from './memory/useMemoryStore';

const NAV: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: 'today', label: 'Today', icon: LayoutDashboard },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarClock },
  { id: 'all', label: 'All tasks', icon: ListTodo },
  { id: 'completed', label: 'Completed', icon: CheckCheck },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'memory', label: 'Memory', icon: Brain },
];

type EditorState = { mode: 'create' } | { mode: 'edit'; task: Task };
type ConfirmState = { kind: 'delete'; task: Task } | { kind: 'clear' };

export default function App() {
  const [init] = useState(() => {
    const result = loadTasks();
    return { tasks: result.firstVisit ? sampleTasks() : result.tasks, corrupted: result.corrupted };
  });

  const [tasks, setTasks] = useState<Task[]>(init.tasks);
  const [today, setToday] = useState(todayISO());
  const [view, setView] = useState<View>('today');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | Category>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(
    init.corrupted ? 'Some saved data was unreadable and was skipped. A backup copy was kept in browser storage when possible.' : null,
  );
  const noticeTimer = useRef<number | undefined>(undefined);
  const memory = useMemoryStore();
  const [panel, setPanel] = useState<{ id: number; state: PanelState } | null>(null);
  const panelCounter = useRef(0);
  const showPanel = (state: PanelState) => {
    panelCounter.current += 1;
    setPanel({ id: panelCounter.current, state });
  };

  // Persist on every change.
  useEffect(() => {
    if (!saveTasks(tasks)) {
      setStorageWarning('Could not save to browser storage. Your changes will be lost on refresh.');
    }
  }, [tasks]);

  // Keep "today" correct if the tab stays open past midnight.
  useEffect(() => {
    const id = window.setInterval(() => setToday(todayISO()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3500);
  }, []);

  /* ----- actions ----- */

  const analyze = async (text: string): Promise<string | null> => {
    const cmd = parseMemoryCommand(text);
    const memoryOff = 'Memory is off. Say “Turn memory on” first, then try again.';

    switch (cmd.kind) {
      case 'clarify':
        return cmd.message;
      case 'setEnabled':
        if (!memory.setEnabled(cmd.enabled)) return 'Could not save the memory setting in this browser.';
        showPanel({
          kind: 'message',
          tone: 'info',
          text: cmd.enabled
            ? 'Memory is on. Your saved memories can be used for suggestions again.'
            : 'Memory is off. Your saved memories are kept, but they will not be used until you turn memory back on.',
        });
        return null;
      case 'remember':
        if (!memory.enabled) return memoryOff;
        showPanel({ kind: 'remember', content: cmd.content, category: cmd.category });
        return null;
      case 'list': {
        if (!memory.enabled) return memoryOff;
        const r = await memory.listFresh();
        if (!r.ok) return r.error;
        showPanel({ kind: 'list', memories: r.value });
        return null;
      }
      case 'forget': {
        if (!memory.enabled) return memoryOff;
        const r = await memory.findForForget(cmd.query);
        if (!r.ok) return r.error;
        if (r.value.length === 0) {
          showPanel({ kind: 'message', tone: 'warn', text: `No saved memory matched “${cmd.query}”. Nothing was deleted.` });
        } else {
          showPanel({ kind: 'forget', query: cmd.query, matches: r.value });
        }
        return null;
      }
      case 'none': {
        const parsed = parseTasks(cmd.text, new Date());
        if (parsed.length === 0) {
          return 'I could not find a task in that text. Try something like “Call the bank tomorrow at 3 PM”.';
        }
        setDrafts((prev) => [
          ...prev,
          ...parsed.map((p) => ({ ...p, key: newId(), skipMemory: cmd.skipMemory })),
        ]);
        return null;
      }
    }
  };

  const confirmDrafts = () => {
    const valid = drafts.filter((d) => validateInput(d) === null);
    if (valid.length === 0) return;
    setTasks((prev) => [...prev, ...valid.map((d) => inputToTask(d))]);
    setDrafts(drafts.filter((d) => validateInput(d) !== null));
    flash(`Saved ${valid.length} task${valid.length === 1 ? '' : 's'}.`);
  };

  const saveEditor = (input: TaskInput) => {
    if (!editor) return;
    if (editor.mode === 'edit') {
      const target = editor.task;
      setTasks((prev) => prev.map((t) => (t.id === target.id ? inputToTask(input, t) : t)));
      flash('Task updated.');
    } else {
      setTasks((prev) => [...prev, inputToTask(input)]);
      flash('Task added.');
    }
    setEditor(null);
  };

  const toggleTask = (id: string) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t)),
    );

  const cyclePriority = (id: string) =>
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, priority: PRIORITIES[(PRIORITIES.indexOf(t.priority) + 1) % PRIORITIES.length] } : t,
      ),
    );

  const runConfirmed = () => {
    if (!confirmState) return;
    if (confirmState.kind === 'delete') {
      const id = confirmState.task.id;
      setTasks((prev) => prev.filter((t) => t.id !== id));
      flash('Task deleted.');
    } else {
      setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
      flash('Completed tasks cleared.');
    }
    setConfirmState(null);
  };

  /* ----- derived data ----- */

  const sorted = useMemo(() => [...tasks].sort(compareTasks), [tasks]);
  const conflicts = useMemo(() => overlapMap(tasks), [tasks]);

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'completed').length;
  const remaining = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const overdue = sorted.filter((t) => t.status === 'pending' && t.date !== undefined && t.date < today);
  const todayTasks = sorted.filter((t) => t.date === today);
  const upcoming = sorted.filter((t) => t.status === 'pending' && t.date !== undefined && t.date > today);
  const completed = sorted.filter((t) => t.status === 'completed');
  const filtered = sorted.filter(
    (t) =>
      (statusFilter === 'all' || t.status === statusFilter) &&
      (categoryFilter === 'all' || t.category === categoryFilter),
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const todayPending = todayTasks.filter((t) => t.status === 'pending').length;
  const summary =
    total === 0
      ? 'Capture your first task below. Speak it or type it.'
      : `${todayPending} task${todayPending === 1 ? '' : 's'} left today${
          overdue.length ? ` · ${overdue.length} overdue` : ''
        } · ${remaining} open in total`;

  const renderTask = (t: Task) => (
    <TaskItem
      key={t.id}
      task={t}
      today={today}
      conflicts={conflicts.get(t.id)}
      onToggle={() => toggleTask(t.id)}
      onEdit={() => setEditor({ mode: 'edit', task: t })}
      onDelete={() => setConfirmState({ kind: 'delete', task: t })}
      onPriority={() => cyclePriority(t.id)}
    />
  );

  /* ----- views ----- */

  let content: JSX.Element;

  if (view === 'today') {
    content = (
      <div className="space-y-8">
        {overdue.length > 0 && (
          <Section title="Overdue" count={overdue.length} tone="danger">
            {overdue.map(renderTask)}
          </Section>
        )}
        <Section title="Today" subtitle={formatDateLong(today)} count={todayTasks.length}>
          {todayTasks.length > 0 ? (
            todayTasks.map(renderTask)
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="Nothing scheduled for today"
              text="Dictate a plan above, or add a task manually. Today's tasks will show up here."
            />
          )}
        </Section>
        <Section title="Upcoming" count={upcoming.length}>
          {upcoming.length > 0 ? (
            <>
              {upcoming.slice(0, 5).map(renderTask)}
              {upcoming.length > 5 && (
                <button type="button" className="btn-ghost" onClick={() => setView('upcoming')}>
                  View all {upcoming.length} upcoming tasks
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-500">No upcoming tasks.</p>
          )}
        </Section>
      </div>
    );
  } else if (view === 'upcoming') {
    const groups: Array<[string, Task[]]> = [];
    for (const t of upcoming) {
      const d = t.date ?? '';
      const last = groups[groups.length - 1];
      if (last && last[0] === d) last[1].push(t);
      else groups.push([d, [t]]);
    }
    content =
      groups.length > 0 ? (
        <div className="space-y-8">
          {groups.map(([date, list]) => (
            <Section key={date} title={formatDateShort(date, today)} subtitle={formatDateLong(date)} count={list.length}>
              {list.map(renderTask)}
            </Section>
          ))}
        </div>
      ) : (
        <EmptyState icon={CalendarClock} title="No upcoming tasks" text="Tasks dated after today will be listed here." />
      );
  } else if (view === 'all') {
    content = (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="w-40">
            <label className="label" htmlFor="filter-status">
              Status
            </label>
            <select
              id="filter-status"
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | Status)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="w-44">
            <label className="label" htmlFor="filter-category">
              Category
            </label>
            <select
              id="filter-category"
              className="input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | Category)}
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Section title="All tasks" count={filtered.length}>
          {filtered.length > 0 ? (
            filtered.map(renderTask)
          ) : (
            <EmptyState
              icon={Inbox}
              title={total === 0 ? 'No tasks yet' : 'No tasks match these filters'}
              text={total === 0 ? 'Use the capture box above to add your first tasks.' : 'Try changing the status or category filter.'}
            />
          )}
        </Section>
      </div>
    );
  } else if (view === 'completed') {
    content = (
      <Section title="Completed" count={completed.length}>
        {completed.length > 0 ? (
          <>
            {completed.map(renderTask)}
            <button type="button" className="btn-ghost text-red-300 hover:text-red-200" onClick={() => setConfirmState({ kind: 'clear' })}>
              <Trash2 size={15} />
              Clear completed
            </button>
          </>
        ) : (
          <EmptyState icon={CheckCheck} title="Nothing completed yet" text="Tick a task's circle to mark it done. It will move here." />
        )}
      </Section>
    );
  } else if (view === 'memory') {
    content = <MemoryCenter store={memory} />;
  } else {
    content = <Schedule tasks={sorted} today={today} conflicts={conflicts} renderTask={renderTask} />;
  }

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900 px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-ink-950">
            <Mic size={18} />
          </div>
          <span className="text-lg font-semibold tracking-tight text-zinc-50">VoxTask</span>
        </div>
        <nav aria-label="Main" className="space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-current={view === id ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                view === id ? 'bg-emerald-500/10 text-emerald-300' : 'text-zinc-400 hover:bg-ink-800 hover:text-zinc-100'
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-lg border border-ink-700 bg-ink-850 p-3 text-xs text-zinc-500">
          Prototype. Tasks live only in this browser. Parsing is rule-based, not AI.
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 pb-28 md:px-10 md:py-8 md:pb-10">
        <div className="mx-auto max-w-4xl space-y-6">
          {storageWarning && (
            <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <span>{storageWarning}</span>
              <button type="button" className="icon-btn -my-1 shrink-0" aria-label="Dismiss warning" onClick={() => setStorageWarning(null)}>
                <X size={16} />
              </button>
            </div>
          )}

          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-400">{formatDateLong(today)}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">{greeting}</h1>
              <p className="mt-1 text-sm text-zinc-400">{summary}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!memory.enabled && (
                <button
                  type="button"
                  className="chip border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                  onClick={() => setView('memory')}
                  title="Memory is off. Open the Memory Center."
                >
                  <Brain size={12} />
                  Memory off
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={() => setEditor({ mode: 'create' })}>
                <Plus size={16} />
                New task
              </button>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total tasks" value={total} />
            <StatCard label="Completed" value={done} />
            <StatCard label="Remaining" value={remaining} />
            <div className="card p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-medium text-zinc-400">Progress</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-300">{pct}%</p>
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700"
                role="progressbar"
                aria-label="Overall completion"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          <CaptureCard onAnalyze={analyze} />

          {panel && (
            <MemoryCommandPanel
              key={panel.id}
              panel={panel.state}
              store={memory}
              onClose={() => setPanel(null)}
              onNotice={flash}
              onOpenCenter={() => {
                setPanel(null);
                setView('memory');
              }}
            />
          )}

          {drafts.length > 0 && (
            <ReviewPanel
              drafts={drafts}
              onChange={setDrafts}
              onConfirm={confirmDrafts}
              onDiscard={() => setDrafts([])}
              memoryEnabled={memory.enabled}
              retrieve={memory.retrieve}
            />
          )}

          {content}

          <footer className="flex items-start gap-2 border-t border-ink-700 pt-4 text-xs text-zinc-500">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              VoxTask is a prototype. Tasks (localStorage) and memories (IndexedDB) are stored only in this browser and are never sent to a server by VoxTask. Task
              extraction uses simple rules, not AI, so always review the preview.
            </p>
          </footer>
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-ink-700 bg-ink-900/95 backdrop-blur md:hidden">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-current={view === id ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
              view === id ? 'text-emerald-300' : 'text-zinc-500'
            }`}
          >
            <Icon size={19} />
            {label === 'All tasks' ? 'All' : label}
          </button>
        ))}
      </nav>

      {notice && (
        <div role="status" className="fixed right-4 top-4 z-50 rounded-lg border border-emerald-500/40 bg-ink-900 px-4 py-2 text-sm text-emerald-300 shadow-lg shadow-black/30">
          {notice}
        </div>
      )}

      {editor && (
        <TaskModal
          key={editor.mode === 'edit' ? editor.task.id : 'new'}
          heading={editor.mode === 'edit' ? 'Edit task' : 'New task'}
          initial={editor.mode === 'edit' ? taskToInput(editor.task) : emptyInput(today)}
          onSave={saveEditor}
          onClose={() => setEditor(null)}
          memoryEnabled={memory.enabled}
          retrieve={memory.retrieve}
        />
      )}

      {confirmState && (
        <ConfirmDialog
          title={confirmState.kind === 'delete' ? 'Delete this task?' : 'Clear completed tasks?'}
          message={
            confirmState.kind === 'delete'
              ? `“${confirmState.task.title}” will be permanently removed.`
              : `All ${completed.length} completed tasks will be permanently removed.`
          }
          confirmLabel={confirmState.kind === 'delete' ? 'Delete' : 'Clear all'}
          onConfirm={runConfirmed}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
