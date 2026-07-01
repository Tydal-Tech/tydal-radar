import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readProspects,
  readPipeline,
  writeProspects,
  writePipeline,
  putPipeline,
  enqueue,
  outboxAll,
  dequeue,
  clearAll,
} from './offline';
import type { Prospect, Pipeline } from './types';

const prospect = (place_id: string, over: Partial<Prospect> = {}): Prospect => ({
  place_id,
  name: `P-${place_id}`,
  type: 'dental',
  neighborhood: 'Ville-Marie',
  lat: 45.5,
  lng: -73.57,
  phone: null,
  address: null,
  rating: null,
  user_rating_count: null,
  website: null,
  ...over,
});
const pipeline = (place_id: string, over: Partial<Pipeline> = {}): Pipeline => ({
  place_id,
  stage: 'knocked',
  note: null,
  contact_name: null,
  current_provider: null,
  contract_expiry: null,
  follow_up_date: null,
  lost_reason: null,
  stage_updated_at: null,
  ...over,
});

beforeEach(async () => {
  await clearAll();
});

describe('offline prospects/pipeline mirror', () => {
  it('round-trips prospects', async () => {
    expect(await readProspects()).toEqual([]);
    await writeProspects([prospect('a'), prospect('b')]);
    const got = await readProspects();
    expect(got.map((p) => p.place_id).sort()).toEqual(['a', 'b']);
  });

  it('replaces the whole prospects store on write (reflects deletions)', async () => {
    await writeProspects([prospect('a'), prospect('b')]);
    await writeProspects([prospect('b'), prospect('c')]);
    expect((await readProspects()).map((p) => p.place_id).sort()).toEqual(['b', 'c']);
  });

  it('round-trips pipeline rows', async () => {
    await writePipeline([pipeline('a', { stage: 'client' })]);
    const got = await readPipeline();
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ place_id: 'a', stage: 'client' });
  });

  it('putPipeline upserts a single row without clearing others', async () => {
    await writePipeline([pipeline('a'), pipeline('b')]);
    await putPipeline(pipeline('a', { stage: 'talked' }));
    const byId = Object.fromEntries((await readPipeline()).map((r) => [r.place_id, r]));
    expect(byId.a.stage).toBe('talked');
    expect(byId.b.stage).toBe('knocked');
  });
});

describe('outbox', () => {
  it('enqueues pending writes', async () => {
    expect(await outboxAll()).toEqual([]);
    await enqueue(pipeline('a', { stage: 'talked' }));
    await enqueue(pipeline('b', { stage: 'client' }));
    expect((await outboxAll()).map((r) => r.place_id).sort()).toEqual(['a', 'b']);
  });

  it('overwrites the pending entry for the same prospect (last-write-wins)', async () => {
    await enqueue(pipeline('a', { stage: 'talked' }));
    await enqueue(pipeline('a', { stage: 'client', note: 'final' }));
    const all = await outboxAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ place_id: 'a', stage: 'client', note: 'final' });
  });

  it('dequeues a synced entry', async () => {
    await enqueue(pipeline('a'));
    await enqueue(pipeline('b'));
    await dequeue('a');
    expect((await outboxAll()).map((r) => r.place_id)).toEqual(['b']);
  });

  it('clearAll empties every store', async () => {
    await writeProspects([prospect('a')]);
    await writePipeline([pipeline('a')]);
    await enqueue(pipeline('a'));
    await clearAll();
    expect(await readProspects()).toEqual([]);
    expect(await readPipeline()).toEqual([]);
    expect(await outboxAll()).toEqual([]);
  });
});
