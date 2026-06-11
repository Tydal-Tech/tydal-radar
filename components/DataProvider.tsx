'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { pullProspects } from '@/lib/places';

interface DataContextValue {
  views: ProspectView[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastPull: { added: number; total: number } | null;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  refresh: () => Promise<void>;
  save: (
    placeId: string,
    patch: {
      stage?: Stage;
      note?: string | null;
      contact_name?: string | null;
      current_provider?: string | null;
      contract_expiry?: string | null;
      follow_up_date?: string | null;
      lost_reason?: string | null;
    },
  ) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

export default function DataProvider({ children }: { children: React.ReactNode }) {
  const placesLib = useMapsLibrary('places');

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [pipelineMap, setPipelineMap] = useState<Record<string, Pipeline>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPull, setLastPull] = useState<{ added: number; total: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadFromCache = useCallback(async () => {
    try {
      const [ps, pl] = await Promise.all([fetchProspects(), fetchPipeline()]);
      setProspects(ps);
      setPipelineMap(Object.fromEntries(pl.map((row) => [row.place_id, row])));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  const refresh = useCallback(async () => {
    if (!placesLib || refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const { prospects: pulled, errors } = await pullProspects(placesLib);
      const before = new Set(prospects.map((p) => p.place_id));
      const added = pulled.filter((p) => !before.has(p.place_id)).length;
      await upsertProspects(pulled);
      await loadFromCache();
      setLastPull({ added, total: pulled.length });
      if (errors.length) setError(`${errors.length} query error(s). ${errors[0]}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [placesLib, refreshing, prospects, loadFromCache]);

  const save = useCallback(
    async (
      placeId: string,
      patch: {
        stage?: Stage;
        note?: string | null;
        contact_name?: string | null;
        current_provider?: string | null;
        contract_expiry?: string | null;
        follow_up_date?: string | null;
        lost_reason?: string | null;
      },
    ) => {
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
          patch.contact_name !== undefined
            ? patch.contact_name
            : (prev?.contact_name ?? null),
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
      // Optimistic update
      setPipelineMap((m) => ({ ...m, [placeId]: next }));
      try {
        await persistPipeline(next);
      } catch (e) {
        setPipelineMap((m) => ({ ...m, [placeId]: prev }));
        setError((e as Error).message);
        throw e;
      }
    },
    [pipelineMap],
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
    selectedId,
    setSelectedId,
    refresh,
    save,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
