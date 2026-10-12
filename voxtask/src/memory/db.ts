import type { Memory } from './types';
import { toMemory } from './validate';

/* IndexedDB repository for memories. No UI code and no logging of memory content. */

export const DB_NAME = 'voxtask-memory';
export const DB_VERSION = 1;
const STORE = 'memories';

export type StorageErrorCode = 'unavailable' | 'open' | 'blocked' | 'transaction';

export class MemoryStorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(message: string, code: StorageErrorCode) {
    super(message);
    this.name = 'MemoryStorageError';
    this.code = code;
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new MemoryStorageError(
        'Browser storage (IndexedDB) is not available. It may be disabled in private browsing or by browser settings.',
        'unavailable',
      ),
    );
  }
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      reject(new MemoryStorageError('The memory database could not be opened.', 'open'));
      return;
    }
    // Idempotent schema setup: safe to run on first creation or any later upgrade.
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('category', 'category');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(new MemoryStorageError('The memory database could not be opened.', 'open'));
    req.onblocked = () =>
      reject(new MemoryStorageError('The memory database is blocked by another VoxTask tab. Close other tabs and retry.', 'blocked'));
  });
  dbPromise = p;
  p.catch(() => {
    if (dbPromise === p) dbPromise = null;
  });
  return p;
}

export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  try {
    (await dbPromise).close();
  } catch {
    /* ignore */
  }
  dbPromise = null;
}

/** Runs `work` in one transaction and resolves only after the transaction has completed. */
async function transact<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore, setResult: (v: T) => void) => void,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    let result = undefined as T;
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, mode);
    } catch {
      reject(new MemoryStorageError('The memory database is not ready. Please retry.', 'transaction'));
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(new MemoryStorageError('The memory database operation failed.', 'transaction'));
    tx.onabort = () =>
      reject(new MemoryStorageError('The memory database operation was cancelled (storage may be full).', 'transaction'));
    try {
      work(tx.objectStore(STORE), (v) => {
        result = v;
      });
    } catch {
      try {
        tx.abort();
      } catch {
        /* ignore */
      }
    }
  });
}

export interface StoredMemories {
  memories: Memory[];
  skipped: number;
}

/** Reads all records, silently skipping malformed ones (they are counted, never shown). */
export async function getAllMemories(): Promise<StoredMemories> {
  const raw = await transact<unknown[]>('readonly', (store, set) => {
    const req = store.getAll();
    req.onsuccess = () => set(req.result as unknown[]);
  });
  const memories: Memory[] = [];
  let skipped = 0;
  for (const item of raw ?? []) {
    const m = toMemory(item, { requireId: true });
    if (m) memories.push(m);
    else skipped++;
  }
  return { memories, skipped };
}

export async function putMemory(memory: Memory): Promise<void> {
  await transact<void>('readwrite', (store) => {
    store.put(memory);
  });
}

export async function putMemories(memories: Memory[]): Promise<void> {
  await transact<void>('readwrite', (store) => {
    for (const m of memories) store.put(m);
  });
}

export async function deleteMemory(id: string): Promise<void> {
  await transact<void>('readwrite', (store) => {
    store.delete(id);
  });
}

export async function clearMemories(): Promise<void> {
  await transact<void>('readwrite', (store) => {
    store.clear();
  });
}
