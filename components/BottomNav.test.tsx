// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BottomNav from './BottomNav';

afterEach(cleanup);

describe('BottomNav', () => {
  it('renders the four nav tabs', () => {
    render(<BottomNav value="map" onChange={vi.fn()} />);
    for (const name of [/Map/, /Search/, /Follow-ups/, /Contracts/]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('calls onChange with the tapped tab value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BottomNav value="map" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /Search/ }));
    expect(onChange).toHaveBeenCalledWith('search');
    await user.click(screen.getByRole('button', { name: /Contracts/ }));
    expect(onChange).toHaveBeenCalledWith('contracts');
  });

  it('shows the follow-up count in the label when present', () => {
    render(<BottomNav value="map" onChange={vi.fn()} followUpCount={3} />);
    expect(screen.getByRole('button', { name: /Follow-ups \(3\)/ })).toBeTruthy();
  });

  it('omits the count when there are no follow-ups', () => {
    render(<BottomNav value="map" onChange={vi.fn()} followUpCount={0} />);
    expect(screen.queryByRole('button', { name: /Follow-ups \(/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Follow-ups/ })).toBeTruthy();
  });
});
