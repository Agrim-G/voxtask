import { beforeEach, describe, expect, it } from 'vitest';
import { clearMemories, closeDb, DB_NAME, deleteMemory, getAllMemories, putMemories, putMemory } from './db';
import { buildExport, buildMemory, parseImport, toMemory, validateMemoryInput } from './validate';

beforeEach(async () => {
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

const mk = (content: string) => buildMemory({ content, category: 'Other' });

describe('IndexedDB repository', () => {
  it('persists, reads, edits and deletes memories', async () => {
    const a = mk('I prefer studying before noon');
    await putMemory(a);
    await closeDb(); // simulates a page reload: reopen from disk
    expect((await getAllMemories()).memories.map((m) => m.id)).toEqual([a.id]);

    await putMemory({ ...a, content: 'I prefer studying at night' });
    expect((await getAllMemories()).memories[0].content).toBe('I prefer studying at night');

    await deleteMemory(a.id);
    expect((await getAllMemories()).memories).toHaveLength(0);
  });

  it('clears everything', async () => {
    await putMemories([mk('First memory here'), mk('Second memory here')]);
    expect((await getAllMemories()).memories).toHaveLength(2);
    await clearMemories();
    expect((await getAllMemories()).memories).toHaveLength(0);
  });

  it('skips malformed stored records without throwing', async () => {
    const good = mk('A perfectly good memory');
    await putMemory(good);
    await putMemory({ id: 'bad', content: 42 } as never);
    await putMemory({ id: 'bad2', content: 'x', category: 'Nope' } as never);
    const r = await getAllMemories();
    expect(r.memories.map((m) => m.id)).toEqual([good.id]);
    expect(r.skipped).toBe(2);
  });
});

describe('validation, export and import', () => {
  it('validates input', () => {
    expect(validateMemoryInput({ content: '', category: 'Other' })).not.toBeNull();
    expect(validateMemoryInput({ content: 'ok', category: 'Other' })).not.toBeNull();
    expect(validateMemoryInput({ content: 'my api key is abc', category: 'Other' })).not.toBeNull();
    expect(validateMemoryInput({ content: 'I like quiet mornings', category: 'Preference' })).toBeNull();
  });

  it('exports valid JSON that re-imports as all duplicates', () => {
    const m = mk('I like quiet mornings');
    const json = buildExport([m]);
    const parsed = JSON.parse(json);
    expect(parsed.memories[0].source).toBe('manual');
    const again = parseImport(json, [m]);
    expect(again.ok && again.report).toEqual({ total: 1, added: 0, duplicates: 1, invalid: 0 });
  });

  it('imports new items, skips duplicates and counts invalid ones', () => {
    const existing = mk('I like quiet mornings');
    const fresh = mk('I run on Sundays');
    const text = JSON.stringify({
      app: 'voxtask-memory',
      version: 1,
      memories: [
        fresh,
        { ...fresh, id: 'other-id' }, // same text in file
        { ...existing, id: 'zzz' }, // same text as stored
        { content: 'x', category: 'Nope' },
        { content: 'my password is 1234', category: 'Other' },
        { content: 'Bad date here', category: 'Other', createdAt: 'not-a-date' },
      ],
    });
    const r = parseImport(text, [existing]);
    expect(r.ok && r.report).toEqual({ total: 6, added: 1, duplicates: 2, invalid: 3 });
  });

  it('rejects non-JSON and foreign JSON', () => {
    expect(parseImport('nope', []).ok).toBe(false);
    expect(parseImport('{"hello":1}', []).ok).toBe(false);
  });

  it('toMemory forces source to manual and rejects others', () => {
    expect(toMemory({ content: 'Fine text here', category: 'Goal', source: 'auto' }, { requireId: false })).toBeNull();
  });
});
