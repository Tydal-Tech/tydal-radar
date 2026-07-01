// Best-time-to-knock: a per-ICP-type heuristic for when a decision-maker is
// most likely available and receptive. This is the 🟢 domain-knowledge version
// (no live hours data yet) — refine later with Places opening-hours / popular
// times (🔵).

import type { IcpType } from './types';

export interface KnockWindow {
  window: string;
  why: string;
}

const BY_TYPE: Record<IcpType, KnockWindow> = {
  dental: { window: 'Tue–Thu, 2–4 pm', why: 'between patient blocks; mornings are packed' },
  medical: { window: 'Tue–Thu, 2–4 pm', why: 'post-lunch lull before the afternoon rush' },
  veterinary: { window: 'Tue–Thu, 2–4 pm', why: 'quieter mid-afternoon between appointments' },
  gym: { window: 'Weekdays, 11 am–3 pm', why: 'off-peak; mornings and evenings are slammed' },
  daycare: { window: 'Weekdays, 1–3 pm', why: 'nap time — staff can talk; avoid drop-off/pick-up' },
  office: { window: 'Tue–Thu, 10–11:30 am', why: 'settled in, pre-lunch; Mon/Fri are worst' },
};

export function bestKnockTime(type: IcpType): KnockWindow {
  return (
    BY_TYPE[type] ?? { window: 'Tue–Thu, mid-morning', why: 'generally the most receptive window' }
  );
}
