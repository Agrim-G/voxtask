import { describe, expect, it } from 'vitest';
import { findForgetMatches, parseMemoryCommand } from './commands';
import { buildMemory } from './validate';

describe('parseMemoryCommand', () => {
  it('parses remember commands and infers a category', () => {
    const a = parseMemoryCommand('Remember that I prefer studying before noon.');
    expect(a).toEqual({ kind: 'remember', content: 'I prefer studying before noon', category: 'Preference' });
    const b = parseMemoryCommand('remember that my gym session takes 90 minutes');
    expect(b.kind === 'remember' && b.category).toBe('Routine');
    const c = parseMemoryCommand('Remember that VoxTask is my personal productivity project');
    expect(c.kind === 'remember' && c.category).toBe('Project');
  });

  it('asks for clarification instead of inventing memories', () => {
    for (const t of ['Remember', 'Remember that', 'Remember to call mom', 'Remember that gym', 'Remember that I have an exam tomorrow']) {
      expect(parseMemoryCommand(t).kind).toBe('clarify');
    }
  });

  it('refuses secrets', () => {
    expect(parseMemoryCommand('Remember that my password is hunter2').kind).toBe('clarify');
    expect(parseMemoryCommand('Remember that my card is 4111 1111 1111 1111').kind).toBe('clarify');
  });

  it('parses list, toggle and forget commands', () => {
    expect(parseMemoryCommand('What do you remember about me?').kind).toBe('list');
    expect(parseMemoryCommand('Turn memory off.')).toEqual({ kind: 'setEnabled', enabled: false });
    expect(parseMemoryCommand('turn memory on')).toEqual({ kind: 'setEnabled', enabled: true });
    expect(parseMemoryCommand('Forget my study preference.')).toEqual({ kind: 'forget', query: 'study preference' });
    expect(parseMemoryCommand('Forget everything').kind).toBe('clarify');
  });

  it('handles the per-task skip phrase', () => {
    expect(parseMemoryCommand("Study reasoning tomorrow. Don't use memory for this task.")).toEqual({
      kind: 'none',
      text: 'Study reasoning tomorrow',
      skipMemory: true,
    });
    expect(parseMemoryCommand("Don't use memory for this task").kind).toBe('clarify');
  });

  it('passes ordinary task text through', () => {
    expect(parseMemoryCommand('Call the bank tomorrow at 3 PM')).toEqual({
      kind: 'none',
      text: 'Call the bank tomorrow at 3 PM',
      skipMemory: false,
    });
  });
});

describe('findForgetMatches', () => {
  const mems = [
    buildMemory({ content: 'I prefer studying before noon', category: 'Preference' }),
    buildMemory({ content: 'I prefer tea over coffee', category: 'Preference' }),
    buildMemory({ content: 'My gym session takes 90 minutes', category: 'Routine' }),
  ];
  it('prefers memories matching every word', () => {
    const r = findForgetMatches('study preference', mems);
    expect(r).toHaveLength(1);
    expect(r[0].content).toContain('studying');
  });
  it('returns several candidates when ambiguous', () => {
    expect(findForgetMatches('preference', mems)).toHaveLength(2);
  });
  it('returns nothing for unrelated queries', () => {
    expect(findForgetMatches('swimming', mems)).toHaveLength(0);
  });
});
