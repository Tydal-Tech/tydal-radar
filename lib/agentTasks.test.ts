import { describe, it, expect } from 'vitest';
import { taskRow } from './agentTasks';

describe('taskRow', () => {
  it('normalizes a PR task to a pending row', () => {
    expect(taskRow({ kind: 'pr', title: 'Bump next', link: 'http://x/1', role: 'maintenance-engineer', department: 'engineering', runId: 'r1' })).toEqual({
      kind: 'pr',
      title: 'Bump next',
      detail: null,
      link: 'http://x/1',
      role: 'maintenance-engineer',
      department: 'engineering',
      run_id: 'r1',
      status: 'pending',
    });
  });

  it('defaults optional fields to null', () => {
    const r = taskRow({ kind: 'escalation', title: 'auth change' });
    expect(r).toMatchObject({ detail: null, link: null, role: null, department: null, run_id: null, status: 'pending' });
  });

  it('caps title and detail so an agent can never dump a diff into the queue', () => {
    const r = taskRow({ kind: 'escalation', title: 't'.repeat(1000), detail: 'd'.repeat(5000) });
    expect(r.title.length).toBe(300);
    expect(r.detail!.length).toBe(2000);
  });
});
