'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { Pipeline, Prospect, ProspectView } from '@/lib/types';
import type { Stage } from '@/lib/stages';
import {
  fetchPipeline,
  fetchProspects,
  savePipeline as persistPipeline,
  upsertProspects,
} from '@/lib/db';
import {
  readProspects,
  readPipeline,
  writeProspects,
  writePipeline,
  putPipeline,
  enqueue,
  outboxAll,
  dequeue,
} from '@/lib/offline';
import { pullProspects } from '@/lib/places';

type SavePatch = {
  stage?: Stage;
  note?: string | null;
  contact_name?: string | null;
  current_provider?: string | null;
  contract_expiry?: string | null;
  follow_up_date?: string | null;
  lost_reason?: string | null;
};

interface DataContextValue {
  views: ProspectView[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastPull: { added: number; total: number } | null;
  online: boolean;
  pending: number; // queued pipeline writes awaiting sync
  syncing: boolean;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  refresh: () => Promise<void>;
  save: (placeId: string, patch: SavePatch) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

const toMap = (rows: Pipeline[]): Record<string, Pipeline> =>
  Object.fromEntries(rows.map((row) => [row.place_id, row]));

// Note: Node 18+ (SSR) defines a global `navigator` WITHOUT `onLine`, so guard
// on the property, not on `navigator` existing — otherwise the server defaults
// to "offline" and hydration mismatches the (online) client on first paint.
const isOnline = () => typeof navigator?.onLine !== 'boolean' || navigator.onLine;

export default function DataProvider({ children }: { children: React.ReactNode }) {
  const placesLib = useMapsLibrary('places');

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [pipelineMap, setPipelineMap] = useState<Record<string, Pipeline>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPull, setLastPull] = useState<{ added: number; total: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [online, setOnline] = useState(isOnline);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const flushingRef = useRef(false);

  const refreshPending = useCallback(async () => {
    setPending((await outboxAll()).length);
  }, []);

  // Push queued pipeline writes to Supabase. Stops on the first failure (still
  // offline / transient) and retries on the next trigger; the guard prevents
  // overlapping flushes.
  const flushOutbox = useCallback(async () => {
    if (flushingRef.current || !isOnline()) return;
    flushingRef.current = true;
    setSyncing(true);
    try {
      for (const row of await outboxAll()) {
        try {
          await persistPipeline(row);
          await dequeue(row.place_id);
        } catch {
          break;
        }
      }
    } finally {
      flushingRef.current = false;
      setSyncing(false);
      await refreshPending();
    }
  }, [refreshPending]);

  // Read the local mirror first (instant, offline-capable), then revalidate from
  // Supabase when online. Queued (outbox) edits always win over server rows.
  const load = useCallback(async () => {
    const [cachedP, cachedPl] = await Promise.all([readProspects(), readPipeline()]);
    if (cachedP.length) setProspects(cachedP);
    if (cachedPl.length) setPipelineMap(toMap(cachedPl));
    setLoading(false);
    await refreshPending();

    if (!isOnline()) {
      if (!cachedP.length) setError('Offline — connect once to load prospects.');
      return;
    }
    try {
      const [ps, pl] = await Promise.all([fetchProspects(), fetchPipeline()]);
      const queued = await outboxAll();
      setProspects(ps);
      setPipelineMap({ ...toMap(pl), ...toMap(queued) });
      await writeProspects(ps);
      await writePipeline(pl);
      for (const row of queued) await putPipeline(row); // keep optimistic rows
      setError(null);
      flushOutbox();
    } catch (e) {
      if (!cachedP.length) setError((e as Error).message);
    }
  }, [refreshPending, flushOutbox]);

  useEffect(() => {
    load();
  }, [load]);

  // Sync when connectivity returns or the app is foregrounded — iOS has no
  // Background Sync API, so flushing happens while the app is open.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      flushOutbox();
    };
    const goOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setOnline(isOnline());
        flushOutbox();
      }
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [flushOutbox]);

  const refresh = useCallback(async () => {
    if (!placesLib || refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const { prospects: pulled, errors } = await pullProspects(placesLib);
      const before = new Set(prospects.map((p) => p.place_id));
      const added = pulled.filter((p) => !before.has(p.place_id)).length;
      await upsertProspects(pulled);
      await load();
      setLastPull({ added, total: pulled.length });
      if (errors.length) setError(`${errors.length} query error(s). ${errors[0]}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [placesLib, refreshing, prospects, load]);

  const save = useCallback(
    async (placeId: string, patch: SavePatch) => {
      const prev = pipelineMap[placeId];
      const nextStage = patch.stage ?? prev?.stage ?? 'not_knocked';
      // Stamp stage_updated_at only when the stage actually changes — that's the
      // timestamp Analytics' weekly activity reads (note/field edits don't count).
      const stageChanged = patch.stage !== undefined && patch.stage !== prev?.stage;
      const next: Pipeline = {
        place_id: placeId,
        stage: nextStage,
        note: patch.note !== undefined ? patch.note : (prev?.note ?? null),
        contact_name:
          patch.contact_name !== undefined ? patch.contact_name : (prev?.contact_name ?? null),
        current_provider:
          patch.current_provider !== undefined
            ? patch.current_provider
            : (prev?.current_provider ?? null),
        contract_expiry:
          patch.contract_expiry !== undefined
            ? patch.contract_expiry
            : (prev?.contract_expiry ?? null),
        follow_up_date:
          patch.follow_up_date !== undefined
            ? patch.follow_up_date
            : (prev?.follow_up_date ?? null),
        lost_reason:
          patch.lost_reason !== undefined ? patch.lost_reason : (prev?.lost_reason ?? null),
        stage_updated_at: stageChanged
          ? new Date().toISOString()
          : (prev?.stage_updated_at ?? null),
      };
      // Optimistic: update memory + the durable local mirror + the outbox, then
      // try to sync. A network/offline failure keeps the edit queued (no
      // rollback) — it flushes on reconnect.
      setPipelineMap((m) => ({ ...m, [placeId]: next }));
      await putPipeline(next);
      await enqueue(next);
      await refreshPending();
      flushOutbox();
    },
    [pipelineMap, refreshPending, flushOutbox],
  );

  const views = useMemo<ProspectView[]>(
    () =>
      prospects.map((p) => {
        const pl = pipelineMap[p.place_id];
        return {
          ...p,
          stage: pl?.stage ?? 'not_knocked',
          note: pl?.note ?? null,
          contact_name: pl?.contact_name ?? null,
          current_provider: pl?.current_provider ?? null,
          contract_expiry: pl?.contract_expiry ?? null,
          follow_up_date: pl?.follow_up_date ?? null,
          lost_reason: pl?.lost_reason ?? null,
          stage_updated_at: pl?.stage_updated_at ?? null,
        };
      }),
    [prospects, pipelineMap],
  );

  const value: DataContextValue = {
    views,
    loading,
    refreshing,
    error,
    lastPull,
    online,
    pending,
    syncing,
    selectedId,
    setSelectedId,
    refresh,
    save,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
