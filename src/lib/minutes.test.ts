import { describe, expect, it } from 'vitest';
import { allActions, endTime, formatClock, overrun, parseNames, plannedMinutes, spentMinutes, timedAgenda, toMarkdown, validateAction, validateMeeting, type Meeting } from './minutes';

const m: Meeting = {
  id: 'm',
  title: 'Weekly sync',
  date: '2026-11-23',
  start: '09:50',
  location: 'Room 2',
  attendees: ['Ana', 'Ben'],
  absent: ['Chloe'],
  agenda: [
    { id: 'a1', title: 'Updates', minutes: 10, presenter: 'Ana', notes: 'All on track.', spent: 720 },
    { id: 'a2', title: 'Budget', minutes: 15, presenter: '', notes: '', spent: 0 },
  ],
  decisions: [{ id: 'd1', text: 'Ship on Friday', itemId: 'a1' }, { id: 'd2', text: 'Move retro to Thursday', itemId: null }],
  actions: [{ id: 'x1', text: 'Draft | release notes', owner: 'Ben', due: '2026-11-20', done: false, itemId: 'a1' }],
};

describe('time maths', () => {
  it('computes planned/spent time and end times across the hour and midnight', () => {
    expect(plannedMinutes(m)).toBe(25);
    expect(spentMinutes(m)).toBe(12);
    expect(endTime('09:50', 25)).toBe('10:15');
    expect(endTime('23:50', 20)).toBe('00:10');
    expect(timedAgenda(m).map((x) => x.at)).toEqual(['09:50', '10:00']);
  });
  it('reports overrun and formats a clock', () => {
    expect(overrun(m.agenda[0])).toBe(120);
    expect(overrun(m.agenda[1])).toBe(0);
    expect(formatClock(125)).toBe('2:05');
    expect(formatClock(-3)).toBe('0:00');
  });
});

describe('actions and input', () => {
  it('lists actions across meetings with overdue flags, open first', () => {
    const done = { ...m, id: 'n', actions: [{ id: 'x2', text: 'Done thing', owner: 'Ana', due: '', done: true, itemId: null }] };
    const list = allActions([done, m], '2026-11-23');
    expect(list.map((x) => [x.action.id, x.overdue])).toEqual([['x1', true], ['x2', false]]);
  });
  it('parses names and validates', () => {
    expect(parseNames('Ana, Ben; Ana\nChloe ')).toEqual(['Ana', 'Ben', 'Chloe']);
    expect(Object.keys(validateMeeting({ title: '', date: 'x', start: '9:30' })).sort()).toEqual(['date', 'start', 'title']);
    expect(validateAction({ text: 'x', owner: ' ' }).owner).toBeDefined();
  });
});

describe('markdown export', () => {
  const md = toMarkdown(m);
  it('includes header, attendance and timed agenda', () => {
    expect(md).toContain('# Weekly sync');
    expect(md).toContain('**Time:** 09:50–10:02');
    expect(md).toContain('**Apologies:** Chloe');
    expect(md).toContain('### 1. Updates — Ana');
    expect(md).toContain('_09:50 · 10 min planned, 12 min taken_');
  });
  it('places decisions under items and lists the rest separately', () => {
    expect(md).toContain('> **Decision:** Ship on Friday');
    expect(md).toContain('## Other decisions\n\n- Move retro to Thursday');
  });
  it('writes an escaped actions table', () => {
    expect(md).toContain('|   | Draft \\| release notes | Ben | 2026-11-20 |');
  });
});
