import { useState } from 'react';
import type { FormEvent } from 'react';
import type { TaskInput } from '../types';
import { validateInput } from '../lib/tasks';
import { Modal } from './Modal';
import type { RetrievalResult } from '../memory/types';
import { MemorySuggestions } from './MemorySuggestions';
import { TaskFields } from './TaskFields';

interface Props {
  heading: string;
  initial: TaskInput;
  onSave: (value: TaskInput) => void;
  onClose: () => void;
  memoryEnabled: boolean;
  retrieve: (input: TaskInput) => Promise<RetrievalResult>;
}

export function TaskModal({ heading, initial, onSave, onClose, memoryEnabled, retrieve }: Props) {
  const [value, setValue] = useState<TaskInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [skipMemory, setSkipMemory] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = validateInput(value);
    if (problem) {
      setError(problem);
      return;
    }
    onSave(value);
  };

  return (
    <Modal title={heading} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <TaskFields
          value={value}
          idPrefix="modal"
          autoFocusTitle
          onChange={(next) => {
            setValue(next);
            setError(null);
          }}
        />
        <MemorySuggestions
          input={value}
          enabled={memoryEnabled}
          skip={skipMemory}
          onSkipChange={setSkipMemory}
          retrieve={retrieve}
          onChange={(next) => {
            setValue(next);
            setError(null);
          }}
        />
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save task
          </button>
        </div>
      </form>
    </Modal>
  );
}
