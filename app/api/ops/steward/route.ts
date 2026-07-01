import { NextResponse } from 'next/server';
import { fetchAll, serviceClient } from '@/lib/serverDb';
import { runAgent, BudgetError } from '@/lib/runAgent';
import { computeSteward, type StewardRow } from '@/lib/steward';
import { raiseTask, pendingTasks } from '@/lib/agentTasks';
import { sendPush } from '@/lib/serverPush';
import type { Pipeline, Prospect } from '@/lib/types';
import type { AgentRunResult } from '@/lib/runAgent';

// Pipeline Steward (Phase 1, Revenue) — a daily Vercel Cron (see vercel.json).
// Reads pipeline health, has Claude (Haiku) write a "chase today" digest through
// runAgent (so it's metered/capped like every agent), raises an escalation task
// for any going-cold quote, and pushes the digest. Logs + alerts only — it never
// messages a prospect. Excluded from the app-password gate (proxy.ts);
// authenticated via CRON_SECRET like notify-followups.
export const dynamic = 'force-dynamic';

const MODEL = 'claude-haiku-4-5';

async function digest(facts: string[], key: string): Promise<AgentRunResult<string>> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system:
        "You are the Pipeline Steward for a Montréal commercial-cleaning company's door-to-door sales team. Given today's pipeline facts, write a short, punchy \"what to chase today\" note: 2-3 bullets max, plain text, no preamble, no markdown headers. Be specific and action-oriented.",
      messages: [{ role: 'user', content: facts.join('\n') }],
    }),
  });
  if (!resp.ok) throw new Error(`Claude ${resp.status}`);
  const data = (await resp.json()) as {
    content?: { type?: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
    id?: string;
  };
  const text = (data.content ?? []).find((b) => b?.type === 'text')?.text?.trim() ?? '';
  return {
    result: text,
    usage: { inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 },
    requestId: data.id,
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let db;
  try {
    db = serviceClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'Steward not configured (service key missing).' }, { status: 500 });
  }

  try {
    const [pipeline, prospects] = await Promise.all([
      fetchAll<Pipeline>('pipeline'),
      fetchAll<Prospect>('prospects'),
    ]);
    const names = new Map(prospects.map((p) => [p.place_id, p.name]));
    const rows: StewardRow[] = pipeline.map((p) => ({
      place_id: p.place_id,
      name: names.get(p.place_id) ?? p.place_id,
      stage: p.stage,
      stage_updated_at: p.stage_updated_at,
      follow_up_date: p.follow_up_date,
    }));

    const d = computeSteward(rows);
    if (!d.actionable) return NextResponse.json({ ok: true, actionable: false });

    // Escalate going-cold quotes — deduped against what's already pending (the
    // cron runs daily; don't re-raise the same deal every morning).
    const pend = await pendingTasks(db);
    const known = new Set(
      pend.filter((t) => t.kind === 'escalation').map((t) => (t.detail ?? '').split(' ')[0]),
    );
    let escalated = 0;
    for (const e of d.escalations) {
      if (known.has(e.place_id)) continue;
      await raiseTask(db, {
        kind: 'escalation',
        title: `Going-cold quote: ${e.name}`,
        detail: `${e.place_id} · quoted, ${e.daysStale}d untouched — nudge before it's lost.`,
        role: 'pipeline-steward',
        department: 'revenue',
      });
      escalated += 1;
    }

    // Claude digest through runAgent (metered/capped). Best-effort: on no key or a
    // budget block, fall back to the deterministic facts so the push still goes out.
    const key = process.env.ANTHROPIC_API_KEY;
    let body = d.facts.join(' ');
    if (key) {
      try {
        const { result } = await runAgent<string>({
          role: 'pipeline-steward',
          department: 'revenue',
          model: MODEL,
          triggeredBy: 'schedule',
          run: () => digest(d.facts, key),
        });
        if (result) body = result;
      } catch (e) {
        if (!(e instanceof BudgetError)) {
          // non-budget failure → keep the deterministic body, don't fail the cron
        }
      }
    }

    await sendPush('Tydal · pipeline', body.slice(0, 300));
    return NextResponse.json({
      ok: true,
      actionable: true,
      goingCold: d.goingCold.length,
      escalated,
      dueToday: d.dueToday,
      overdue: d.overdue,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'steward failed' }, { status: 500 });
  }
}
