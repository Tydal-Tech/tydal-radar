// Offline mirror of the Supabase data, plus an outbox of pending pipeline
// writes. Lets the app read prospects offline (stale-while-revalidate in
// DataProvider) and never lose a stage/note edit made in a dead zone — see
// docs/offline-first.md. All ops degrade to no-ops where IndexedDB is absent
// (SSR / unsupported), so callers don't need to guard.

import { openDB, type IDBPDatabase } from 'idb';
import type { Prospect, Pipeline } from './types';

const DB_NAME = 'tydal-radar';
const DB_VERSION = 1;
const STORES = ['prospects', 'pipeline', 'outbox'] as const;
type StoreName = (typeof STORES)[number];

let dbp: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === 'undefined') return null;
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'place_id' });
          }
        }
      },
    });
  }
  return dbp;
}

async function readAll<T>(store: StoreName): Promise<T[]> {
  const db = getDb();
  if (!db) return [];
  return (await (await db).getAll(store)) as T[];
}

// Replace the whole store contents atomically (mirrors a full server fetch, so
// server-side deletions are reflected locally).
async function replaceAll<T>(store: StoreName, rows: T[]): Promise<void> {
  const db = getDb();
  if (!db) return;
  const tx = (await db).transaction(store, 'readwrite');
  await tx.store.clear();
  for (const row of rows) await tx.store.put(row);
  await tx.done;
}

async function putOne<T>(store: StoreName, row: T): Promise<void> {
  const db = getDb();
  if (!db) return;
  await (await db).put(store, row);
}

export const readProspects = () => readAll<Prospect>('prospects');
export const readPipeline = () => readAll<Pipeline>('pipeline');
export const writeProspects = (rows: Prospect[]) => replaceAll('prospects', rows);
export const writePipeline = (rows: Pipeline[]) => replaceAll('pipeline', rows);

/** Persist one pipeline row to the local mirror (optimistic save). */
export const putPipeline = (row: Pipeline) => putOne('pipeline', row);

/** Queue a pipeline write to sync later; keyed by place_id so a re-edit of the
 *  same prospect overwrites the pending one (last-write-wins). */
export const enqueue = (row: Pipeline) => putOne('outbox', row);
export const outboxAll = () => readAll<Pipeline>('outbox');

export async function dequeue(placeId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await (await db).delete('outbox', placeId);
}

/** Clear every local store (used by tests and any future "reset device"). */
export async function clearAll(): Promise<void> {
  const db = getDb();
  if (!db) return;
  const tx = (await db).transaction(STORES, 'readwrite');
  await Promise.all(STORES.map((s) => tx.objectStore(s).clear()));
  await tx.done;
}
