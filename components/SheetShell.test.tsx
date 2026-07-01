// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import SheetShell from './SheetShell';

afterEach(cleanup);

describe('SheetShell (accessibility)', () => {
  it('exposes a labelled modal dialog', () => {
    render(
      <SheetShell onClose={vi.fn()} ariaLabel="Search">
        <div>body</div>
      </SheetShell>,
    );
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeTruthy();
  });

  it('closes on the Escape key', () => {
    const onClose = vi.fn();
    render(
      <SheetShell onClose={onClose} ariaLabel="Contracts">
        <div>body</div>
      </SheetShell>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders its children', () => {
    render(
      <SheetShell onClose={vi.fn()} ariaLabel="Follow-ups">
        <div>list-body</div>
      </SheetShell>,
    );
    expect(screen.getByText('list-body')).toBeTruthy();
  });
});
