import { CATEGORIES, PRIORITIES } from '../types';
import type { Category, Priority, TaskInput } from '../types';

interface Props {
  value: TaskInput;
  onChange: (next: TaskInput) => void;
  idPrefix: string;
  autoFocusTitle?: boolean;
}

export function TaskFields({ value, onChange, idPrefix, autoFocusTitle = false }: Props) {
  const set = (patch: Partial<TaskInput>) => onChange({ ...value, ...patch });
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
      <div className="col-span-2 sm:col-span-6">
        <label className="label" htmlFor={id('title')}>
          Title
        </label>
        <input
          id={id('title')}
          className="input"
          value={value.title}
          maxLength={140}
          placeholder="What needs to be done?"
          autoFocus={autoFocusTitle}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>

      <div className="col-span-2 sm:col-span-6">
        <label className="label" htmlFor={id('desc')}>
          Notes (optional)
        </label>
        <input
          id={id('desc')}
          className="input"
          value={value.description}
          maxLength={300}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>

      <div className="col-span-2 sm:col-span-2">
        <label className="label" htmlFor={id('date')}>
          Date
        </label>
        <input
          id={id('date')}
          type="date"
          className="input"
          value={value.date}
          onChange={(e) => set({ date: e.target.value })}
        />
      </div>

      <div className="col-span-1 sm:col-span-2">
        <label className="label" htmlFor={id('time')}>
          Start time
        </label>
        <input
          id={id('time')}
          type="time"
          className="input"
          value={value.startTime}
          onChange={(e) => set({ startTime: e.target.value })}
        />
      </div>

      <div className="col-span-1 sm:col-span-2">
        <label className="label" htmlFor={id('dur')}>
          Duration (min)
        </label>
        <input
          id={id('dur')}
          type="number"
          min={1}
          max={1440}
          inputMode="numeric"
          className="input"
          placeholder="e.g. 60"
          value={value.duration}
          onChange={(e) => set({ duration: e.target.value })}
        />
      </div>

      <div className="col-span-1 sm:col-span-3">
        <label className="label" htmlFor={id('cat')}>
          Category
        </label>
        <select
          id={id('cat')}
          className="input"
          value={value.category}
          onChange={(e) => set({ category: e.target.value as Category })}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-1 sm:col-span-3">
        <label className="label" htmlFor={id('prio')}>
          Priority
        </label>
        <select
          id={id('prio')}
          className="input"
          value={value.priority}
          onChange={(e) => set({ priority: e.target.value as Priority })}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
