import { MEMORY_CATEGORIES } from '../memory/types';
import type { MemoryCategory, MemoryInput } from '../memory/types';
import { MAX_CONTENT } from '../memory/validate';

interface Props {
  value: MemoryInput;
  onChange: (next: MemoryInput) => void;
  idPrefix: string;
  autoFocus?: boolean;
}

export function MemoryFields({ value, onChange, idPrefix, autoFocus = false }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor={`${idPrefix}-content`}>
          Memory
        </label>
        <textarea
          id={`${idPrefix}-content`}
          rows={3}
          className="input resize-y"
          maxLength={MAX_CONTENT}
          autoFocus={autoFocus}
          placeholder="e.g. I prefer studying before noon"
          value={value.content}
          onChange={(e) => onChange({ ...value, content: e.target.value })}
        />
        <p className="mt-1 text-right text-xs text-zinc-500">
          {value.content.length}/{MAX_CONTENT}
        </p>
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-category`}>
          Category
        </label>
        <select
          id={`${idPrefix}-category`}
          className="input"
          value={value.category}
          onChange={(e) => onChange({ ...value, category: e.target.value as MemoryCategory })}
        >
          {MEMORY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
