import { useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import type { Task } from '../types';
import { addDays, formatDateLong, formatTime, isValidISODate } from '../lib/dates';
import { EmptyState, Section } from './ui';

interface Props {
  tasks: Task[]; // expected to be pre-sorted
  today: string;
  conflicts: Map<string, string[]>;
  renderTask: (task: Task) => ReactNode;
}

export function Schedule({ tasks, today, conflicts, renderTask }: Props) {
  const [day, setDay] = useState(today);

  const dayTasks = tasks.filter((t) => t.date === day);
  const timed = dayTasks.filter((t) => t.startTime);
  const untimed = dayTasks.filter((t) => !t.startTime);
  const conflictCount = timed.filter((t) => conflicts.has(t.id)).length;

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs text-zinc-500">Daily agenda</p>
          <h2 className="text-lg font-semibold text-zinc-50">{formatDateLong(day)}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="icon-btn" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="btn-secondary" onClick={() => setDay(today)} disabled={day === today}>
            Today
          </button>
          <button type="button" className="icon-btn" aria-label="Next day" onClick={() => setDay(addDays(day, 1))}>
            <ChevronRight size={18} />
          </button>
          <input
            type="date"
            aria-label="Pick a day"
            className="input w-auto"
            value={day}
            onChange={(e) => {
              if (isValidISODate(e.target.value)) setDay(e.target.value);
            }}
          />
        </div>
      </div>

      {conflictCount > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <Info size={16} className="mt-0.5 shrink-0" />
          {conflictCount} scheduled tasks overlap on this day. Adjust their times to avoid a clash.
        </p>
      )}

      {dayTasks.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="Nothing planned for this day"
          text="Dictate or type tasks above, or add one manually, and they will appear here in time order."
        />
      )}

      {timed.length > 0 && (
        <Section title="Scheduled" count={timed.length}>
          <div className="space-y-3 border-l border-ink-700 pl-3">
            {timed.map((t) => (
              <div key={t.id} className="flex gap-3">
                <div className="w-20 shrink-0 pt-4 text-right text-xs tabular-nums text-zinc-400">
                  {t.startTime ? formatTime(t.startTime) : ''}
                </div>
                <div className="min-w-0 flex-1">{renderTask(t)}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {untimed.length > 0 && (
        <Section title="Unscheduled" subtitle="no start time set" count={untimed.length}>
          {untimed.map((t) => renderTask(t))}
        </Section>
      )}
    </div>
  );
}
