import { Check, Clock, Info, Pencil, Trash2 } from 'lucide-react';
import type { Priority, Task } from '../types';
import { formatDateShort, formatDuration, formatTimeRange } from '../lib/dates';

const PRIORITY_STYLE: Record<Priority, string> = {
  high: 'border-red-500/30 bg-red-500/10 text-red-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  low: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
};

interface Props {
  task: Task;
  today: string;
  conflicts?: string[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPriority: () => void;
}

export function TaskItem({ task, today, conflicts, onToggle, onEdit, onDelete, onPriority }: Props) {
  const done = task.status === 'completed';
  const overdue = !done && task.date !== undefined && task.date < today;

  return (
    <article
      className={`card flex items-start gap-3 p-3.5 transition-colors hover:border-zinc-600 ${done ? 'opacity-70' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Reopen "${task.title}"` : `Mark "${task.title}" as completed`}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          done
            ? 'border-emerald-500 bg-emerald-500 text-ink-950'
            : 'border-zinc-500 text-transparent hover:border-emerald-400 hover:text-emerald-400'
        }`}
      >
        <Check size={13} strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <p className={`break-words text-sm font-medium ${done ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
          {task.title}
        </p>
        {task.description && <p className="mt-0.5 break-words text-xs text-zinc-500">{task.description}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {task.date ? (
            <span className={`chip ${overdue ? 'border-red-500/40 text-red-300' : ''}`}>
              {formatDateShort(task.date, today)}
              {overdue ? ' · overdue' : ''}
            </span>
          ) : (
            <span className="chip text-zinc-500">No date</span>
          )}
          {task.startTime && (
            <span className="chip">
              <Clock size={12} />
              {formatTimeRange(task.startTime, task.durationMinutes)}
            </span>
          )}
          {!task.startTime && task.durationMinutes && <span className="chip">{formatDuration(task.durationMinutes)}</span>}
          <span className="chip">{task.category}</span>
          <button
            type="button"
            onClick={onPriority}
            title="Click to change priority"
            aria-label={`Priority ${task.priority}. Click to change.`}
            className={`chip capitalize transition-colors hover:brightness-125 ${PRIORITY_STYLE[task.priority]}`}
          >
            {task.priority}
          </button>
        </div>

        {conflicts && conflicts.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-300">
            <Info size={13} className="mt-0.5 shrink-0" />
            Overlaps with {conflicts.join(', ')}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center">
        <button type="button" className="icon-btn" aria-label={`Edit "${task.title}"`} onClick={onEdit}>
          <Pencil size={15} />
        </button>
        <button type="button" className="icon-btn hover:text-red-300" aria-label={`Delete "${task.title}"`} onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}
