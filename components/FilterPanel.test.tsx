// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterPanel from './FilterPanel';
import { GeolocationProvider } from './GeolocationProvider';
import { EMPTY_FILTERS, type Filters } from '@/lib/filters';
import type { ProspectView } from '@/lib/types';

afterEach(cleanup);

function makeView(p: Partial<ProspectView> = {}): ProspectView {
  return {
    place_id: Math.random().toString(36).slice(2),
    name: 'X',
    type: 'dental',
    neighborhood: 'Ville-Marie',
    lat: 45.5,
    lng: -73.57,
    phone: null,
    address: null,
    rating: null,
    user_rating_count: null,
    website: null,
    stage: 'not_knocked',
    note: null,
    contact_name: null,
    current_provider: null,
    contract_expiry: null,
    follow_up_date: null,
    lost_reason: null,
    stage_updated_at: null,
    ...p,
  };
}

describe('FilterPanel — multi-select types', () => {
  it('adds a type to the set when its chip is tapped', async () => {
    const user = userEvent.setup();
    const setFilters = vi.fn();
    render(
      <FilterPanel views={[makeView({ type: 'dental' })]} filters={EMPTY_FILTERS} setFilters={setFilters} />,
      { wrapper: GeolocationProvider },
    );
    await user.click(screen.getByRole('button', { name: /Dental/i }));
    expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ types: ['dental'] }));
  });

  it('removes a type when its already-selected chip is tapped again', async () => {
    const user = userEvent.setup();
    const setFilters = vi.fn();
    const filters: Filters = { ...EMPTY_FILTERS, types: ['dental'] };
    render(
      <FilterPanel views={[makeView({ type: 'dental' })]} filters={filters} setFilters={setFilters} />,
      { wrapper: GeolocationProvider },
    );
    await user.click(screen.getByRole('button', { name: /Dental/i }));
    expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ types: [] }));
  });

  it('shows "Clear all" only when a filter is active', () => {
    const { rerender } = render(
      <FilterPanel views={[]} filters={EMPTY_FILTERS} setFilters={vi.fn()} />,
      { wrapper: GeolocationProvider },
    );
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
    rerender(
      <FilterPanel views={[]} filters={{ ...EMPTY_FILTERS, types: ['gym'] }} setFilters={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeNull();
  });
});

describe('FilterPanel — near-me quick filter', () => {
  it('sets nearMe + not_knocked when tapped', async () => {
    const user = userEvent.setup();
    const setFilters = vi.fn();
    render(<FilterPanel views={[]} filters={EMPTY_FILTERS} setFilters={setFilters} />, {
      wrapper: GeolocationProvider,
    });
    await user.click(screen.getByRole('button', { name: /Near me/i }));
    expect(setFilters).toHaveBeenCalledWith(
      expect.objectContaining({ nearMe: true, stage: 'not_knocked' }),
    );
  });

  it('clears back to all when tapped while active', async () => {
    const user = userEvent.setup();
    const setFilters = vi.fn();
    const active: Filters = { ...EMPTY_FILTERS, nearMe: true, stage: 'not_knocked' };
    render(<FilterPanel views={[]} filters={active} setFilters={setFilters} />, {
      wrapper: GeolocationProvider,
    });
    await user.click(screen.getByRole('button', { name: /Near me/i }));
    expect(setFilters).toHaveBeenCalledWith(
      expect.objectContaining({ nearMe: false, stage: 'all' }),
    );
  });
});
