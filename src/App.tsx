import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DemoTag, EmptyState, Field, Landing, NotFound, Notice, PageHead, Shell, copyText, downloadText, uid, useFlash, usePersistentState, useRoute } from './shared/ui';
import { DataTable, useTable, type Column } from './shared/table';
import { addDays, formatDay, todayISO } from './shared/dates';
import { TEMPLATES, allActions, endTime, formatClock, overrun, parseNames, plannedMinutes, spentMinutes, timedAgenda, toMarkdown, validateAction, validateMeeting, type Action, type AgendaItem, type Meeting, type OpenAction } from './lib/minutes';

const KEY = 'minutehand:store';
const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/meetings', label: 'Meetings' },
  { to: '/actions', label: 'Actions' },
];

interface Store {
  meetings: Meeting[];
}

const item = (title: string, minutes: number, presenter = '', notes = '', spent = 0): AgendaItem => ({ id: uid('ag'), title, minutes, presenter, notes, spent });

export function demoMeetings(today: string): Meeting[] {
  const last = addDays(today, -7);
  const a1 = item('Check-in', 5, 'Priya', 'Everyone well; Tom back from leave.', 290);
  const a2 = item('Last week’s actions', 10, 'Priya', 'Two of three done. Supplier quote still outstanding.', 640);
  const a3 = item('Launch readiness', 20, 'Marco', 'QA found two blocking bugs in checkout; fixes in review. Marketing assets ready.\n\nRisk: the payment provider sandbox was down on Tuesday.', 1560);
  const a4 = item('Hiring', 10, 'Priya', 'Second-round interviews for the designer role next week.', 480);
  const a5 = item('Actions and wrap-up', 5, '', '', 240);
  const b1 = item('Check-in', 5, 'Priya');
  const b2 = item('Launch go / no-go', 20, 'Marco');
  const b3 = item('Customer feedback from the beta, including the accessibility review and support ticket themes', 15, 'Sam');
  const b4 = item('Actions and wrap-up', 5);
  return [
    {
      id: 'demo-last', title: 'Weekly product sync', date: last, start: '10:00', location: 'Meeting room 2 / video link', attendees: ['Priya (chair)', 'Marco', 'Sam', 'Tom', 'Lee (notes)'], absent: ['Ines'],
      agenda: [a1, a2, a3, a4, a5],
      decisions: [{ id: 'd1', text: 'Launch moves to Thursday if both checkout bugs are fixed by Tuesday.', itemId: a3.id }, { id: 'd2', text: 'Use the existing interview panel for round two.', itemId: a4.id }],
      actions: [
        { id: 'x1', text: 'Fix the two checkout bugs and request review', owner: 'Marco', due: addDays(today, -2), done: true, itemId: a3.id },
        { id: 'x2', text: 'Chase supplier quote', owner: 'Tom', due: addDays(today, -3), done: false, itemId: a2.id },
        { id: 'x3', text: 'Book interview rooms', owner: 'Priya', due: addDays(today, 2), done: false, itemId: a4.id },
        { id: 'x4', text: 'Write the launch announcement draft', owner: 'Sam', due: addDays(today, 1), done: false, itemId: a3.id },
      ],
      demo: true,
    },
    { id: 'demo-next', title: 'Weekly product sync', date: today, start: '10:00', location: 'Meeting room 2 / video link', attendees: ['Priya (chair)', 'Marco', 'Sam', 'Tom', 'Ines', 'Lee (notes)'], absent: [], agenda: [b1, b2, b3, b4], decisions: [], actions: [], demo: true },
  ];
}

export default function App() {
  const [route, navigate] = useRoute();
  const today = todayISO();
  const [store, setStore] = usePersistentState<Store>(KEY, () => ({ meetings: demoMeetings(today) }));
  const ctx = { store, setStore, today, navigate };
  const run = route.match(/^\/meeting\/([^/]+)\/run$/);
  const view = route.match(/^\/meeting\/([^/]+)(?:\/(agenda|notes|minutes))?$/);
  let page: ReactNode;
  if (route === '/') page = <Home />;
  else if (route === '/meetings') page = <Meetings {...ctx} />;
  else if (run) page = <Run {...ctx} id={run[1]} />;
  else if (view) page = <MeetingPage {...ctx} id={view[1]} tab={(view[2] as Tab) ?? 'agenda'} />;
  else if (route === '/actions') page = <Actions {...ctx} />;
  else page = <NotFound />;
  return (
    <Shell name="Minutehand" wordmark={['Minute', 'hand']} nav={NAV} route={route} cta={{ to: '/meetings', label: 'New meeting' }} footerNote="Minutes stay in this browser until you copy or download them.">
      {page}
    </Shell>
  );
}

type SetStore = React.Dispatch<React.SetStateAction<Store>>;
type Ctx = { store: Store; setStore: SetStore; today: string; navigate: (to: string) => void };
type Tab = 'agenda' | 'notes' | 'minutes';

function useMeeting(store: Store, setStore: SetStore, id: string) {
  const m = store.meetings.find((x) => x.id === id);
  // Functional update so rapid changes (the run-mode timer) always build on the latest state.
  const update = (patch: Partial<Meeting> | ((m: Meeting) => Partial<Meeting>)) =>
    setStore((prev) => ({ meetings: prev.meetings.map((x) => (x.id === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x)) }));
  return [m, update] as const;
}

function AgendaTimeline({ m, compact }: { m: Meeting; compact?: boolean }) {
  const total = Math.max(1, plannedMinutes(m));
  return (
    <div className={`agenda-bar ${compact ? 'is-compact' : ''}`} role="img" aria-label={`Agenda: ${m.agenda.map((a) => `${a.title} ${a.minutes} minutes`).join(', ')}`}>
      {timedAgenda(m).map(({ item: a, at }, i) => (
        <span key={a.id} className={`seg ${a.spent && overrun(a) ? 'is-over' : a.spent ? 'is-done' : ''}`} style={{ flexGrow: a.minutes, ['--i' as string]: i, ['--w' as string]: `${(a.minutes / total) * 100}%` }} title={`${at} ${a.title} · ${a.minutes} min`}>
          <span className="seg-t">{at}</span>
          {!compact && <span className="seg-n">{a.title}</span>}
        </span>
      ))}
    </div>
  );
}

function HeroPreview() {
  const m = demoMeetings(todayISO())[0];
  return (
    <div className="hero-mh">
      <div className="row-between"><strong className="hero-mh-title">{m.title}</strong><span className="small muted">{m.start}–{endTime(m.start, plannedMinutes(m))} · {m.attendees.length} people</span></div>
      <AgendaTimeline m={m} />
      <div className="hero-mh-cols">
        <div><p className="eyebrow">Decisions</p><ul>{m.decisions.map((d) => <li key={d.id}>{d.text}</li>)}</ul></div>
        <div><p className="eyebrow">Actions</p><ul className="hero-actions">{m.actions.slice(0, 3).map((a) => <li key={a.id} className={a.done ? 'done' : ''}><span>{a.text}</span><span className="small muted">{a.owner}</span></li>)}</ul></div>
      </div>
    </div>
  );
}

function Home() {
  return (
    <Landing
      eyebrow="Meeting minutes"
      title={<>Meetings that end <em>with a record.</em></>}
      lead="Plan a timed agenda, keep the meeting on track with a per-item timer, capture notes, decisions and owned actions as you go — then copy clean Markdown minutes the moment it ends."
      primary={{ href: '#/meetings', label: 'Open meetings' }}
      secondary={{ href: '#/actions', label: 'Track actions' }}
      previewLabel="Last week’s minutes — demo"
      preview={<HeroPreview />}
      steps={[
        { title: 'Plan the agenda', body: 'Start from a template or add items with minutes and a presenter. Start times are worked out for you.' },
        { title: 'Run it', body: 'Run mode shows the current item, its timer and what’s next, with quick buttons for decisions and actions.' },
        { title: 'Share the minutes', body: 'Copy or download Markdown minutes, and follow up open actions across every meeting.' },
      ]}
      stepsIntro="Minutehand opens with two labelled, fictional demo meetings — last week’s finished one and today’s, ready to run."
      features={[
        { title: 'Timed agenda', body: 'Planned start time for each item and an at-a-glance bar showing where the time goes.' },
        { title: 'Overrun warnings', body: 'The timer turns amber near the end of an item and red when it runs over.' },
        { title: 'Actions with owners', body: 'Every action needs an owner; due dates flag overdue items across all meetings.' },
        { title: 'Clean Markdown', body: 'Headings, decisions as quotes, and an actions table that pastes neatly into docs and chat.' },
      ]}
      note="Minutehand doesn’t record audio or transcribe — it’s a structured notebook for the person taking minutes."
      closing={{ title: <>Every action <em>has an owner.</em></>, action: { href: '#/meetings', label: 'Plan a meeting' } }}
    />
  );
}

/* ---------- Meetings ---------- */
function Meetings({ store, setStore, today, navigate }: Ctx) {
  const [flash, setFlash] = useFlash();
  const [d, setD] = useState({ title: '', date: today, start: '10:00', template: 'weekly', attendees: '' });
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateMeeting(d) : {};
  const columns: Column<Meeting>[] = [
    { key: 'date', label: 'Date', sort: (m) => m.date + m.start, render: (m) => formatDay(m.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) },
    { key: 'title', label: 'Meeting', sort: (m) => m.title, render: (m) => <><a href={`#/meeting/${m.id}`}>{m.title}</a>{m.demo && <> <DemoTag /></>}<div className="small muted">{m.start}–{endTime(m.start, plannedMinutes(m))} · {m.attendees.length} attending</div></> },
    { key: 'items', label: 'Agenda', num: true, sort: (m) => m.agenda.length, render: (m) => `${m.agenda.length} items` },
    { key: 'open', label: 'Open actions', num: true, sort: (m) => m.actions.filter((a) => !a.done).length, render: (m) => m.actions.filter((a) => !a.done).length },
  ];
  const table = useTable(store.meetings, columns, { initialSort: 'date', initialDir: 'desc' });
  function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateMeeting(d)).length) return;
    const t = TEMPLATES.find((x) => x.key === d.template);
    const id = uid('mtg');
    setStore({ meetings: [...store.meetings, { id, title: d.title.trim(), date: d.date, start: d.start, location: '', attendees: parseNames(d.attendees), absent: [], agenda: t ? t.agenda.map(([title, minutes]) => item(title, minutes)) : [], decisions: [], actions: [] }] });
    navigate(`/meeting/${id}`);
  }
  return (
    <div className="stack">
      <PageHead eyebrow="Meetings" title={<>Plan, run, <em>record.</em></>} />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      <form className="card stack" onSubmit={create} noValidate aria-labelledby="new-m">
        <h2 id="new-m" className="h3">New meeting</h2>
        <div className="form-grid">
          <Field label="Title" error={errors.title}>{(p) => <input {...p} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="e.g. Sprint planning" />}</Field>
          <Field label="Date" error={errors.date}>{(p) => <input {...p} type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />}</Field>
          <Field label="Start time" error={errors.start}>{(p) => <input {...p} className="mono" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })} />}</Field>
          <Field label="Agenda template">{(p) => <select {...p} value={d.template} onChange={(e) => setD({ ...d, template: e.target.value })}>{TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}<option value="">Blank agenda</option></select>}</Field>
        </div>
        <Field label="Attendees" hint="Separate names with commas">{(p) => <input {...p} value={d.attendees} onChange={(e) => setD({ ...d, attendees: e.target.value })} />}</Field>
        <div><button className="btn btn-primary" type="submit">Create meeting</button></div>
      </form>
      {store.meetings.length === 0 ? <EmptyState title="No meetings yet" actions={<button type="button" className="btn" onClick={() => setStore({ meetings: demoMeetings(today) })}>Load demo meetings</button>}>Create one above to plan its agenda.</EmptyState> : (
        <div className="card stack">
          <DataTable caption="Meetings" columns={columns} table={table} rowKey={(m) => m.id} />
          {store.meetings.some((m) => m.demo) && <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStore({ meetings: store.meetings.filter((m) => !m.demo) }); setFlash({ kind: 'success', text: 'Demo meetings removed.' }); }}>Clear demo meetings</button></div>}
        </div>
      )}
    </div>
  );
}

/* ---------- Meeting page ---------- */
function MeetingPage({ store, setStore, today, navigate, id, tab }: Ctx & { id: string; tab: Tab }) {
  const [m, update] = useMeeting(store, setStore, id);
  const [flash, setFlash] = useFlash();
  if (!m) return <EmptyState title="Meeting not found" actions={<a className="btn btn-primary" href="#/meetings">Back to meetings</a>} />;
  const TABS: [Tab, string][] = [['agenda', 'Agenda'], ['notes', 'Notes & actions'], ['minutes', 'Minutes']];
  return (
    <div className="stack">
      <PageHead eyebrow={<><a href="#/meetings">Meetings</a> / {formatDay(m.date, { weekday: 'long', day: 'numeric', month: 'long' })}</>} title={m.title} description={`${m.start}–${endTime(m.start, plannedMinutes(m))} · ${plannedMinutes(m)} min planned${m.location ? ` · ${m.location}` : ''}`}
        actions={<><a className="btn btn-primary" href={`#/meeting/${m.id}/run`}>Run meeting</a><button type="button" className="btn btn-danger" onClick={() => { if (window.confirm(`Delete “${m.title}” on ${m.date}?`)) { setStore({ meetings: store.meetings.filter((x) => x.id !== m.id) }); navigate('/meetings'); } }}>Delete</button></>} />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      {m.demo && <p><DemoTag /> <span className="small muted">A fictional demo meeting.</span></p>}
      <AgendaTimeline m={m} />
      <nav className="tabs" aria-label="Meeting sections">{TABS.map(([t, l]) => <a key={t} href={`#/meeting/${m.id}/${t}`} aria-current={tab === t ? 'page' : undefined} className="tab-link">{l}</a>)}</nav>
      {tab === 'agenda' && <AgendaTab m={m} update={update} />}
      {tab === 'notes' && <NotesTab m={m} update={update} today={today} onFlash={(text) => setFlash({ kind: 'success', text })} />}
      {tab === 'minutes' && <MinutesTab m={m} onFlash={(kind, text) => setFlash({ kind, text })} />}
    </div>
  );
}

function AgendaTab({ m, update }: { m: Meeting; update: ReturnType<typeof useMeeting>[1] }) {
  const [d, setD] = useState({ title: '', minutes: '10', presenter: '' });
  const [err, setErr] = useState<string | null>(null);
  const move = (i: number, dir: -1 | 1) => update((x) => { const a = [...x.agenda]; const j = i + dir; if (j < 0 || j >= a.length) return {}; [a[i], a[j]] = [a[j], a[i]]; return { agenda: a }; });
  function add(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(d.minutes);
    if (!d.title.trim()) return setErr('Name the agenda item.');
    if (!Number.isInteger(n) || n < 1 || n > 240) return setErr('Minutes must be 1–240.');
    setErr(null);
    update((x) => ({ agenda: [...x.agenda, item(d.title.trim(), n, d.presenter.trim())] }));
    setD({ title: '', minutes: '10', presenter: '' });
  }
  return (
    <div className="layout-main">
      <section className="card stack" aria-labelledby="ag-t">
        <h2 id="ag-t" className="h3">Agenda</h2>
        {m.agenda.length === 0 ? <p className="muted">No items yet.</p> : (
          <ol className="agenda-list">
            {timedAgenda(m).map(({ item: a, at }, i) => (
              <li key={a.id}>
                <span className="mono small at">{at}</span>
                <span className="ag-main"><strong>{a.title}</strong><span className="small muted">{a.minutes} min{a.presenter && ` · ${a.presenter}`}</span></span>
                <span className="row nowrap">
                  <button type="button" className="icon-btn" aria-label={`Move ${a.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="icon-btn" aria-label={`Move ${a.title} down`} disabled={i === m.agenda.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className="icon-btn" aria-label={`Remove ${a.title}`} onClick={() => update((x) => ({ agenda: x.agenda.filter((y) => y.id !== a.id) }))}>✕</button>
                </span>
              </li>
            ))}
          </ol>
        )}
        <form className="filters" onSubmit={add} noValidate>
          <Field label="Agenda item" className="grow" error={err}>{(p) => <input {...p} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />}</Field>
          <Field label="Minutes">{(p) => <input {...p} inputMode="numeric" value={d.minutes} onChange={(e) => setD({ ...d, minutes: e.target.value })} />}</Field>
          <Field label="Presenter">{(p) => <input {...p} value={d.presenter} onChange={(e) => setD({ ...d, presenter: e.target.value })} />}</Field>
          <button className="btn" type="submit">Add item</button>
        </form>
      </section>
      <aside className="card stack">
        <h2 className="h3">Details</h2>
        <Field label="Location or link">{(p) => <input {...p} defaultValue={m.location} onBlur={(e) => update({ location: e.target.value.trim() })} />}</Field>
        <Field label="Attending" hint="Comma separated">{(p) => <textarea {...p} rows={3} defaultValue={m.attendees.join(', ')} onBlur={(e) => update({ attendees: parseNames(e.target.value) })} />}</Field>
        <Field label="Apologies (absent)">{(p) => <input {...p} defaultValue={m.absent.join(', ')} onBlur={(e) => update({ absent: parseNames(e.target.value) })} />}</Field>
      </aside>
    </div>
  );
}

function DecisionActionForms({ m, update, itemId, today, onFlash }: { m: Meeting; update: ReturnType<typeof useMeeting>[1]; itemId: string | null; today: string; onFlash: (t: string) => void }) {
  const [dec, setDec] = useState('');
  const [act, setAct] = useState({ text: '', owner: '', due: '' });
  const [actSub, setActSub] = useState(false);
  const errs = actSub ? validateAction(act) : {};
  const owners = m.attendees.map((a) => a.replace(/\s*\(.*\)$/, ''));
  return (
    <div className="grid-2 da">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (!dec.trim()) return; update((x) => ({ decisions: [...x.decisions, { id: uid('d'), text: dec.trim(), itemId }] })); setDec(''); onFlash('Decision recorded.'); }}>
        <Field label="Decision">{(p) => <input {...p} value={dec} onChange={(e) => setDec(e.target.value)} placeholder="What was agreed" />}</Field>
        <div><button className="btn btn-sm" type="submit">Add decision</button></div>
      </form>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); setActSub(true); if (Object.keys(validateAction(act)).length) return; update((x) => ({ actions: [...x.actions, { id: uid('a'), text: act.text.trim(), owner: act.owner.trim(), due: act.due, done: false, itemId }] })); setAct({ text: '', owner: act.owner, due: '' }); setActSub(false); onFlash('Action added.'); }} noValidate>
        <Field label="Action" error={errs.text}>{(p) => <input {...p} value={act.text} onChange={(e) => setAct({ ...act, text: e.target.value })} placeholder="Who does what" />}</Field>
        <div className="form-grid two">
          <Field label="Owner" error={errs.owner}>{(p) => <input {...p} list={`owners-${m.id}`} value={act.owner} onChange={(e) => setAct({ ...act, owner: e.target.value })} />}</Field>
          <Field label="Due">{(p) => <input {...p} type="date" min={today} value={act.due} onChange={(e) => setAct({ ...act, due: e.target.value })} />}</Field>
        </div>
        <datalist id={`owners-${m.id}`}>{owners.map((o) => <option key={o} value={o} />)}</datalist>
        <div><button className="btn btn-sm" type="submit">Add action</button></div>
      </form>
    </div>
  );
}

function NotesTab({ m, update, today, onFlash }: { m: Meeting; update: ReturnType<typeof useMeeting>[1]; today: string; onFlash: (t: string) => void }) {
  return (
    <div className="stack">
      {m.agenda.map((a, i) => (
        <section key={a.id} className="card stack" aria-labelledby={`n-${a.id}`}>
          <div className="card-title-row"><h2 id={`n-${a.id}`} className="h3">{i + 1}. {a.title}</h2><span className="small muted">{a.minutes} min{a.spent ? ` · ${formatClock(a.spent)} taken` : ''}</span></div>
          <Field label={`Notes for ${a.title}`}>{(p) => <textarea {...p} rows={3} defaultValue={a.notes} onBlur={(e) => update((x) => ({ agenda: x.agenda.map((y) => (y.id === a.id ? { ...y, notes: e.target.value } : y)) }))} />}</Field>
          <ItemOutcomes m={m} itemId={a.id} update={update} />
          <DecisionActionForms m={m} update={update} itemId={a.id} today={today} onFlash={onFlash} />
        </section>
      ))}
      {m.agenda.length === 0 && <EmptyState title="No agenda items" actions={<a className="btn" href={`#/meeting/${m.id}/agenda`}>Add agenda items</a>}>Notes, decisions and actions are captured per agenda item.</EmptyState>}
    </div>
  );
}

function ItemOutcomes({ m, itemId, update }: { m: Meeting; itemId: string; update: ReturnType<typeof useMeeting>[1] }) {
  const ds = m.decisions.filter((d) => d.itemId === itemId);
  const as = m.actions.filter((a) => a.itemId === itemId);
  if (!ds.length && !as.length) return null;
  return (
    <div className="outcomes">
      {ds.map((d) => <p key={d.id} className="decision"><strong>Decision:</strong> {d.text} <button type="button" className="icon-btn" aria-label={`Remove decision ${d.text}`} onClick={() => update((x) => ({ decisions: x.decisions.filter((y) => y.id !== d.id) }))}>✕</button></p>)}
      {as.map((a) => <ActionLine key={a.id} a={a} onToggle={() => update((x) => ({ actions: x.actions.map((y) => (y.id === a.id ? { ...y, done: !y.done } : y)) }))} onRemove={() => update((x) => ({ actions: x.actions.filter((y) => y.id !== a.id) }))} />)}
    </div>
  );
}

function ActionLine({ a, onToggle, onRemove, overdue }: { a: Action; onToggle: () => void; onRemove?: () => void; overdue?: boolean }) {
  return (
    <div className={`action ${a.done ? 'is-done' : ''}`}>
      <label className="check"><input type="checkbox" checked={a.done} onChange={onToggle} /> <span>{a.text}</span></label>
      <span className="small">{a.owner}{a.due && <> · <span className={overdue ? 'late' : 'muted'}>due {formatDay(a.due, { day: 'numeric', month: 'short' })}</span></>}</span>
      {onRemove && <button type="button" className="icon-btn" aria-label={`Remove action ${a.text}`} onClick={onRemove}>✕</button>}
    </div>
  );
}

function MinutesTab({ m, onFlash }: { m: Meeting; onFlash: (kind: 'success' | 'error', t: string) => void }) {
  const md = toMarkdown(m);
  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={async () => { const ok = await copyText(md); onFlash(ok ? 'success' : 'error', ok ? 'Markdown copied to the clipboard.' : 'Couldn’t copy — use Download instead.'); }}>Copy Markdown</button>
        <button type="button" className="btn" onClick={() => downloadText(`${m.date}-${m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`, md, 'text/markdown')}>Download .md</button>
      </div>
      <article className="card minutes" aria-label="Minutes preview">
        <h2>{m.title}</h2>
        <p className="small"><strong>{formatDay(m.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong> · {m.start}–{endTime(m.start, spentMinutes(m) || plannedMinutes(m))}{m.location && ` · ${m.location}`}</p>
        <p className="small"><strong>Present:</strong> {m.attendees.join(', ') || '—'}{m.absent.length > 0 && <> · <strong>Apologies:</strong> {m.absent.join(', ')}</>}</p>
        {timedAgenda(m).map(({ item: a, at }, i) => (
          <section key={a.id}>
            <h3>{i + 1}. {a.title}{a.presenter && <span className="muted"> — {a.presenter}</span>}</h3>
            <p className="small muted">{at} · {a.minutes} min planned{a.spent ? `, ${Math.round(a.spent / 60)} min taken` : ''}</p>
            {a.notes && <p className="pre">{a.notes}</p>}
            {m.decisions.filter((d) => d.itemId === a.id).map((d) => <blockquote key={d.id}><strong>Decision:</strong> {d.text}</blockquote>)}
          </section>
        ))}
        <h3>Actions</h3>
        {m.actions.length === 0 ? <p className="muted">No actions recorded.</p> : (
          <div className="table-wrap"><table className="table"><caption className="sr-only">Actions</caption><thead><tr><th scope="col">Done</th><th scope="col">Action</th><th scope="col">Owner</th><th scope="col">Due</th></tr></thead>
            <tbody>{m.actions.map((a) => <tr key={a.id}><td>{a.done ? '✓' : ''}</td><td>{a.text}</td><td>{a.owner}</td><td>{a.due || '—'}</td></tr>)}</tbody></table></div>
        )}
      </article>
      <details><summary className="small">Show raw Markdown</summary><pre className="raw-md">{md}</pre></details>
    </div>
  );
}

/* ---------- Run mode ---------- */
function Run({ store, setStore, today, id }: Ctx & { id: string }) {
  const [m, update] = useMeeting(store, setStore, id);
  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useFlash(2500);
  const current = m?.agenda[idx];
  useEffect(() => {
    if (!running || !current) return;
    const t = setInterval(() => update((x) => ({ agenda: x.agenda.map((a) => (a.id === current.id ? { ...a, spent: a.spent + 1 } : a)) })), 1000);
    return () => clearInterval(t);
  }, [running, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return <EmptyState title="Meeting not found" actions={<a className="btn btn-primary" href="#/meetings">Back</a>} />;
  if (!current) return <EmptyState title="Add agenda items first" actions={<a className="btn btn-primary" href={`#/meeting/${m.id}/agenda`}>Plan the agenda</a>}>Run mode steps through the agenda one item at a time.</EmptyState>;
  const left = current.minutes * 60 - current.spent;
  const state = left < 0 ? 'over' : left <= 60 ? 'near' : 'ok';
  return (
    <div className="stack run">
      <PageHead eyebrow={<><a href={`#/meeting/${m.id}`}>{m.title}</a> / running</>} title={<>Item {idx + 1} <em>of {m.agenda.length}</em></>} actions={<a className="btn" href={`#/meeting/${m.id}/minutes`}>Finish and view minutes</a>} />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      <AgendaTimeline m={m} compact />
      <div className="layout-main">
        <section className={`card stack run-card is-${state}`} aria-labelledby="cur-t">
          <p className="eyebrow">{current.presenter || 'Now'}</p>
          <h2 id="cur-t" className="run-title">{current.title}</h2>
          <div className="clock" role="timer" aria-live="off" aria-label={`${formatClock(current.spent)} of ${current.minutes} minutes used`}>
            <span className="clock-big" data-testid="clock">{left >= 0 ? formatClock(left) : `+${formatClock(-left)}`}</span>
            <span className="small">{left >= 0 ? 'left' : 'over time'} · {current.minutes} min planned</span>
          </div>
          <div className="progress run-progress" role="progressbar" aria-label="Time used for this item" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((current.spent / (current.minutes * 60)) * 100))}><span style={{ width: `${Math.min(100, (current.spent / (current.minutes * 60)) * 100)}%` }} /></div>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => setRunning(!running)}>{running ? 'Pause' : current.spent ? 'Resume' : 'Start'}</button>
            <button type="button" className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Previous</button>
            <button type="button" className="btn" disabled={idx === m.agenda.length - 1} onClick={() => setIdx(idx + 1)}>Next item →</button>
          </div>
          <Field label="Notes">{(p) => <textarea {...p} key={current.id} rows={4} defaultValue={current.notes} onBlur={(e) => update((x) => ({ agenda: x.agenda.map((a) => (a.id === current.id ? { ...a, notes: e.target.value } : a)) }))} />}</Field>
          <ItemOutcomes m={m} itemId={current.id} update={update} />
          <DecisionActionForms m={m} update={update} itemId={current.id} today={today} onFlash={(t) => setFlash({ kind: 'success', text: t })} />
        </section>
        <aside className="card stack">
          <h2 className="h3">Up next</h2>
          <ol className="next-list">{m.agenda.map((a, i) => <li key={a.id} className={i === idx ? 'is-current' : i < idx ? 'is-past' : ''}><button type="button" className="linkish" onClick={() => setIdx(i)}>{a.title}</button><span className="small mono">{a.spent ? formatClock(a.spent) : `${a.minutes}:00`}</span></li>)}</ol>
          <p className="small muted">Total: {spentMinutes(m)} of {plannedMinutes(m)} min used.</p>
        </aside>
      </div>
    </div>
  );
}

/* ---------- Actions ---------- */
function Actions({ store, setStore, today }: Ctx) {
  const [show, setShow] = useState<'open' | 'all' | 'overdue'>('open');
  const [owner, setOwner] = useState('');
  const all = allActions(store.meetings, today);
  const owners = [...new Set(all.map((x) => x.action.owner))].sort();
  const rows = useMemo(() => all.filter((x) => (show === 'all' || (show === 'open' ? !x.action.done : x.overdue)) && (!owner || x.action.owner === owner)), [all, show, owner]);
  const toggle = (x: OpenAction) => setStore({ meetings: store.meetings.map((m) => (m.id === x.meeting.id ? { ...m, actions: m.actions.map((a) => (a.id === x.action.id ? { ...a, done: !a.done } : a)) } : m)) });
  const columns: Column<OpenAction>[] = [
    { key: 'text', label: 'Action', sort: (x) => x.action.text, render: (x) => <label className="check"><input type="checkbox" checked={x.action.done} onChange={() => toggle(x)} aria-label={`Done: ${x.action.text}`} /> <span className={x.action.done ? 'struck' : ''}>{x.action.text}</span></label> },
    { key: 'owner', label: 'Owner', sort: (x) => x.action.owner, render: (x) => x.action.owner },
    { key: 'due', label: 'Due', sort: (x) => x.action.due, render: (x) => (x.action.due ? <span className={x.overdue ? 'badge badge-err' : ''}>{formatDay(x.action.due, { day: 'numeric', month: 'short' })}</span> : '—') },
    { key: 'from', label: 'From', sort: (x) => x.meeting.date, render: (x) => <a href={`#/meeting/${x.meeting.id}/notes`}>{x.meeting.title}, {formatDay(x.meeting.date, { day: 'numeric', month: 'short' })}</a> },
  ];
  const table = useTable(rows, columns, { initialSort: 'due' });
  return (
    <div className="stack">
      <PageHead eyebrow="Actions" title={<>Who’s doing <em>what.</em></>} description={`${all.filter((x) => !x.action.done).length} open · ${all.filter((x) => x.overdue).length} overdue across ${store.meetings.length} meetings`} />
      <div className="card stack">
        <div className="filters">
          <Field label="Show">{(p) => <select {...p} value={show} onChange={(e) => setShow(e.target.value as typeof show)}><option value="open">Open</option><option value="overdue">Overdue</option><option value="all">All</option></select>}</Field>
          <Field label="Owner">{(p) => <select {...p} value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Everyone</option>{owners.map((o) => <option key={o}>{o}</option>)}</select>}</Field>
        </div>
        <DataTable caption="Actions from all meetings" columns={columns} table={table} rowKey={(x) => x.action.id + x.meeting.id} empty="No actions match." />
      </div>
    </div>
  );
}
