// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SyncStatus from './SyncStatus';

afterEach(cleanup);

describe('SyncStatus', () => {
  it('renders nothing when online, idle, and fully synced', () => {
    const { container } = render(<SyncStatus online={true} pending={0} syncing={false} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows "Offline" when offline with nothing queued', () => {
    render(<SyncStatus online={false} pending={0} syncing={false} />);
    expect(screen.getByRole('status').textContent).toMatch(/Offline/);
    expect(screen.getByRole('status').textContent).not.toMatch(/to sync/);
  });

  it('shows the queued count when offline with pending writes', () => {
    render(<SyncStatus online={false} pending={2} syncing={false} />);
    expect(screen.getByRole('status').textContent).toMatch(/Offline/);
    expect(screen.getByRole('status').textContent).toMatch(/2 to sync/);
  });

  it('shows "Syncing…" while flushing', () => {
    render(<SyncStatus online={true} pending={1} syncing={true} />);
    expect(screen.getByRole('status').textContent).toMatch(/Syncing/);
  });

  it('shows the pending count when online with a non-empty queue (not yet syncing)', () => {
    render(<SyncStatus online={true} pending={3} syncing={false} />);
    expect(screen.getByRole('status').textContent).toMatch(/3 to sync/);
  });
});
