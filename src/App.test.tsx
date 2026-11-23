import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('Minutehand', () => {
  it('lists demo meetings and creates one from a template', async () => {
    window.location.hash = '/meetings';
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getAllByText('Demo data').length).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Create meeting' }));
    expect(screen.getByText('Give the meeting a title.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Title'), 'Design retro');
    await user.selectOptions(screen.getByLabelText('Agenda template'), 'retro');
    await user.type(screen.getByLabelText('Attendees'), 'Ana, Ben');
    await user.click(screen.getByRole('button', { name: 'Create meeting' }));
    expect(await screen.findByRole('heading', { name: 'Design retro' })).toBeInTheDocument();
    expect(screen.getAllByText('What went well').length).toBeGreaterThan(0);
  });

  it('adds an action that needs an owner', async () => {
    window.location.hash = '/meeting/demo-next/notes';
    const user = userEvent.setup();
    render(<App />);
    const sec = screen.getByRole('heading', { name: '2. Launch go / no-go' }).closest('section')!;
    await user.type(within(sec).getByLabelText('Action'), 'Tell support the launch date');
    await user.click(within(sec).getByRole('button', { name: 'Add action' }));
    expect(within(sec).getByText('Every action needs an owner.')).toBeInTheDocument();
    await user.type(within(sec).getByLabelText('Owner'), 'Sam');
    await user.click(within(sec).getByRole('button', { name: 'Add action' }));
    expect(within(sec).getByText('Tell support the launch date')).toBeInTheDocument();
  });

  it('renders minutes with decisions and an actions table', () => {
    window.location.hash = '/meeting/demo-last/minutes';
    render(<App />);
    const art = screen.getByRole('article', { name: 'Minutes preview' });
    expect(within(art).getByText(/Launch moves to Thursday/)).toBeInTheDocument();
    expect(within(art).getByRole('table', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByText(/# Weekly product sync/)).toBeInTheDocument();
  });

  it('runs the agenda timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.location.hash = '/meeting/demo-next/run';
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    expect(screen.getByTestId('clock')).toHaveTextContent('5:00');
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByTestId('clock')).toHaveTextContent('4:57');
    await user.click(screen.getByRole('button', { name: 'Next item →' }));
    expect(screen.getByRole('heading', { name: 'Launch go / no-go' })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('tracks open and overdue actions across meetings', async () => {
    window.location.hash = '/actions';
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText(/3 open · 1 overdue/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Done: Chase supplier quote' }));
    expect(screen.getByText(/2 open · 0 overdue/)).toBeInTheDocument();
  });
});
