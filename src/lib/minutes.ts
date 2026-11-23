import { isValidISODate } from '../shared/dates';

export interface AgendaItem {
  id: string;
  title: string;
  minutes: number;
  presenter: string;
  notes: string;
  /** Seconds actually spent, recorded in run mode. */
  spent: number;
}

export interface Action {
  id: string;
  text: string;
  owner: string;
  due: string; // '' if none
  done: boolean;
  itemId: string | null;
}

export interface Decision {
  id: string;
  text: string;
  itemId: string | null;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  start: string; // HH:MM
  location: string;
  attendees: string[];
  absent: string[];
  agenda: AgendaItem[];
  decisions: Decision[];
  actions: Action[];
  demo?: boolean;
}

export const plannedMinutes = (m: Pick<Meeting, 'agenda'>) => m.agenda.reduce((s, a) => s + a.minutes, 0);
export const spentMinutes = (m: Pick<Meeting, 'agenda'>) => Math.round(m.agenda.reduce((s, a) => s + a.spent, 0) / 60);

export function endTime(start: string, minutes: number): string {
  const [h, mm] = start.split(':').map(Number);
  const t = (h * 60 + mm + minutes) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Agenda items with planned start times, e.g. 10:00, 10:05, 10:20… */
export function timedAgenda(m: Meeting) {
  let offset = 0;
  return m.agenda.map((a) => {
    const at = endTime(m.start, offset);
    offset += a.minutes;
    return { item: a, at };
  });
}

export function overrun(a: AgendaItem): number {
  return Math.max(0, a.spent - a.minutes * 60);
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface OpenAction {
  meeting: Meeting;
  action: Action;
  overdue: boolean;
}

export function allActions(meetings: Meeting[], today: string): OpenAction[] {
  return meetings
    .flatMap((meeting) => meeting.actions.map((action) => ({ meeting, action, overdue: !action.done && !!action.due && action.due < today })))
    .sort((a, b) => Number(a.action.done) - Number(b.action.done) || (a.action.due || '9999').localeCompare(b.action.due || '9999'));
}

export function validateMeeting(d: { title: string; date: string; start: string }) {
  const e: Partial<Record<'title' | 'date' | 'start', string>> = {};
  if (!d.title.trim()) e.title = 'Give the meeting a title.';
  if (!isValidISODate(d.date)) e.date = 'Choose a date.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.start)) e.start = 'Use a 24-hour time such as 09:30.';
  return e;
}

export function validateAction(d: { text: string; owner: string }) {
  const e: Partial<Record<'text' | 'owner', string>> = {};
  if (!d.text.trim()) e.text = 'Describe the action.';
  if (!d.owner.trim()) e.owner = 'Every action needs an owner.';
  return e;
}

/** Splits "Ana, Ben (chair); Chloe" style input into clean, unique names. */
export function parseNames(text: string): string[] {
  return [...new Set(text.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))];
}

const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Markdown minutes: header, attendance, agenda with notes and decisions per item, then an actions table. */
export function toMarkdown(m: Meeting): string {
  const out: string[] = [];
  out.push(`# ${m.title}`, '');
  out.push(`**Date:** ${longDate(m.date)}  `, `**Time:** ${m.start}–${endTime(m.start, spentMinutes(m) || plannedMinutes(m))}  `);
  if (m.location) out.push(`**Where:** ${m.location}  `);
  out.push(`**Present:** ${m.attendees.join(', ') || '—'}  `);
  if (m.absent.length) out.push(`**Apologies:** ${m.absent.join(', ')}  `);
  out.push('');
  out.push('## Agenda and notes', '');
  timedAgenda(m).forEach(({ item, at }, i) => {
    out.push(`### ${i + 1}. ${item.title}${item.presenter ? ` — ${item.presenter}` : ''}`, '');
    out.push(`_${at} · ${item.minutes} min planned${item.spent ? `, ${Math.round(item.spent / 60)} min taken` : ''}_`, '');
    if (item.notes.trim()) out.push(item.notes.trim(), '');
    const ds = m.decisions.filter((d) => d.itemId === item.id);
    for (const d of ds) out.push(`> **Decision:** ${d.text}`, '');
  });
  const loose = m.decisions.filter((d) => !d.itemId || !m.agenda.some((a) => a.id === d.itemId));
  if (loose.length) {
    out.push('## Other decisions', '');
    for (const d of loose) out.push(`- ${d.text}`);
    out.push('');
  }
  out.push('## Actions', '');
  if (!m.actions.length) out.push('_No actions recorded._', '');
  else {
    out.push('| | Action | Owner | Due |', '| --- | --- | --- | --- |');
    for (const a of m.actions) out.push(`| ${a.done ? '✓' : ' '} | ${a.text.replace(/\|/g, '\\|')} | ${a.owner} | ${a.due || '—'} |`);
    out.push('');
  }
  return out.join('\n');
}

export interface Template {
  key: string;
  name: string;
  agenda: [string, number][];
}

export const TEMPLATES: Template[] = [
  { key: 'weekly', name: 'Weekly team meeting', agenda: [['Check-in', 5], ['Last week’s actions', 10], ['Updates', 15], ['Decisions needed', 15], ['Actions and wrap-up', 5]] },
  { key: 'kickoff', name: 'Project kickoff', agenda: [['Introductions', 10], ['Goals and success measures', 15], ['Scope and out of scope', 15], ['Timeline and milestones', 10], ['Risks', 5], ['Next steps', 5]] },
  { key: 'retro', name: 'Retrospective', agenda: [['Set the stage', 5], ['What went well', 15], ['What didn’t', 15], ['Ideas to try', 15], ['Agree actions', 10]] },
  { key: 'one', name: 'One-to-one', agenda: [['How are things?', 10], ['Priorities', 10], ['Blockers', 5], ['Growth', 5]] },
];
