// Compare two prospect snapshots (scripts/backup.mjs output) to surface market
// change over time: businesses that appeared (growth) and ones that disappeared
// (churn / closed) between two dates. Pure — shared by the diff script and any
// future "market changes" view.

export interface ProspectLike {
  place_id: string;
  type?: string;
  name?: string;
}

export interface SnapshotDiff<T extends ProspectLike> {
  added: T[];
  removed: T[];
  addedByType: Record<string, number>;
  removedByType: Record<string, number>;
}

function countByType<T extends ProspectLike>(rows: T[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const t = r.type ?? 'unknown';
    m[t] = (m[t] ?? 0) + 1;
  }
  return m;
}

export function diffProspects<T extends ProspectLike>(older: T[], newer: T[]): SnapshotDiff<T> {
  const oldIds = new Set(older.map((p) => p.place_id));
  const newIds = new Set(newer.map((p) => p.place_id));
  const added = newer.filter((p) => !oldIds.has(p.place_id));
  const removed = older.filter((p) => !newIds.has(p.place_id));
  return {
    added,
    removed,
    addedByType: countByType(added),
    removedByType: countByType(removed),
  };
}
