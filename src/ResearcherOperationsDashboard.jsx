import React, { useEffect, useMemo, useState } from 'react';
import WorkplaceBadge from './WorkplaceBadge';
import { ACTIVITY_EVENT, readActivityLog } from './activityLog';
import { finalistEvent, readFinalistSelections } from './finalistSelections';
import { AI_REVIEW_EVENT, readAiReviewQueue } from './recruitmentWorkflow';
import './researcher-operations-dashboard.css';

const HISTORY_KEY = 'vitra-outreach-history-v1';
const ARCHIVE_KEY = 'vitra-completed-recruitment-cycles-v1';
const PUBLIC_STUDIES = 3;
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const eventType = {
  screening_ready_for_ai: 'screening', ai_fit_review_opened: 'ai', final_match_assigned: 'finalist',
  outreach_draft_created: 'outreach', outreach_ready_to_review: 'outreach', outreach_scheduled: 'outreach',
  outreach_sent: 'outreach', outreach_delivered: 'outreach', outreach_responded: 'outreach',
  outreach_opted_out: 'outreach', recruitment_cycle_completed: 'data',
};
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; } };
const dateKey = date => new Date(date).toDateString();
const typeLabel = type => ({ screening_ready_for_ai: 'Screening', ai_fit_review_opened: 'AI Fit Review', final_match_assigned: 'Final Match', outreach_draft_created: 'Outreach draft', outreach_ready_to_review: 'Ready to review', outreach_scheduled: 'Scheduled outreach', outreach_sent: 'Sent', outreach_delivered: 'Delivered', outreach_responded: 'Response', outreach_opted_out: 'Opt-out', recruitment_cycle_completed: 'Completed cycle' }[type] || 'Workflow');

export default function ResearcherOperationsDashboard({ Sidebar }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [activity, setActivity] = useState(readActivityLog);
  const [finalists, setFinalists] = useState(readFinalistSelections);
  const [queue, setQueue] = useState(readAiReviewQueue);
  const [history, setHistory] = useState(() => readJson(HISTORY_KEY, {}));
  const [archives, setArchives] = useState(() => readJson(ARCHIVE_KEY, []));
  const [eventDetail, setEventDetail] = useState(null);

  useEffect(() => {
    const sync = () => { setActivity(readActivityLog()); setFinalists(readFinalistSelections()); setQueue(readAiReviewQueue()); setHistory(readJson(HISTORY_KEY, {})); setArchives(readJson(ARCHIVE_KEY, [])); };
    window.addEventListener(ACTIVITY_EVENT, sync); window.addEventListener(finalistEvent, sync); window.addEventListener(AI_REVIEW_EVENT, sync); window.addEventListener('storage', sync);
    return () => { window.removeEventListener(ACTIVITY_EVENT, sync); window.removeEventListener(finalistEvent, sync); window.removeEventListener(AI_REVIEW_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  const finalistRows = Object.values(finalists);
  const outreachRows = Object.entries(history).map(([key, record]) => ({ key, ...record }));
  const counts = useMemo(() => ({
    participants: new Set([...Object.values(queue).map(row => row.profileId), ...finalistRows.map(row => row.profileId)]).size,
    ai: Object.keys(queue).length,
    finalists: finalistRows.length,
    drafts: finalistRows.filter(row => !history[`${row.researcherId}::${row.profileId}::${row.trialId}::${row.publicSite}`]?.status || history[`${row.researcherId}::${row.profileId}::${row.trialId}::${row.publicSite}`]?.status === 'Draft created').length,
    sent: outreachRows.filter(row => ['Sent', 'Simulated sent'].includes(row.status)).length,
    scheduled: outreachRows.filter(row => row.status === 'Scheduled').length,
    ready: outreachRows.filter(row => row.status === 'Ready to review').length,
    archives: archives.length,
  }), [queue, finalistRows, history, outreachRows, archives]);
  const cards = [
    [PUBLIC_STUDIES, 'Active public studies', '/researcher/trials'], [counts.participants, 'Workflow participants', '/researcher/screening'],
    [counts.ai, 'Ready for AI Fit Review', '/researcher/ai-fit-review'], [counts.finalists, 'Final Matches', '/researcher/recruitment'],
    [counts.drafts, 'Outreach drafts', '/researcher/outreach'], [counts.sent, 'Sent', '/researcher/outreach'], [counts.archives, 'Completed cycles', '/researcher/outreach'],
  ];
  const tasks = [
    counts.ai && { count: counts.ai, text: `Review ${counts.ai} record${counts.ai === 1 ? '' : 's'} ready for AI Fit Review`, href: '/researcher/ai-fit-review' },
    counts.finalists && { count: counts.finalists, text: `Prepare ${counts.finalists} Final Match outreach draft${counts.finalists === 1 ? '' : 's'}`, href: '/researcher/outreach' },
    counts.ready && { count: counts.ready, text: `Review ${counts.ready} outreach draft${counts.ready === 1 ? '' : 's'}`, href: '/researcher/outreach' },
    counts.scheduled && { count: counts.scheduled, text: `Check ${counts.scheduled} scheduled message${counts.scheduled === 1 ? '' : 's'}`, href: '/researcher/outreach' },
    counts.archives && { count: counts.archives, text: `Review ${counts.archives} completed outreach-cycle archive${counts.archives === 1 ? '' : 's'}`, href: '/researcher/outreach' },
  ].filter(Boolean);
  const pipeline = [['Screening queue', counts.participants, '/researcher/screening'], ['AI Fit Review', counts.ai, '/researcher/ai-fit-review'], ['Final Matches', counts.finalists, '/researcher/recruitment'], ['Outreach drafts', counts.drafts, '/researcher/outreach'], ['Sent', counts.sent, '/researcher/outreach']];
  const max = Math.max(1, ...pipeline.map(([, value]) => value));
  const events = useMemo(() => [...activity].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), [activity]);
  const firstDay = month.getDay();
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - firstDay + 1));
  const eventsFor = date => events.filter(event => dateKey(event.timestamp) === dateKey(date));

  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main operations-dashboard">
    <div className="page-head"><div><span className="eyebrow">Fictional synthetic demo workflow data · refreshed {new Date().toLocaleString()}</span><h1>Researcher Dashboard</h1></div><WorkplaceBadge/></div>
    <div className="notice"><span>Dashboard activity reflects fictional synthetic demo workflow data only. Clinical screening, eligibility, enrollment, and outreach decisions are performed by approved study teams.</span></div>
    <section className="operations-metrics">{cards.map(([value, label, href]) => <button key={label} onClick={() => location.assign(href)}><b>{value}</b><span>{label}</span><small>Open workspace →</small></button>)}</section>
    <section className="dashboard-schedule-layout">
      <article className="operations-card large-calendar-card"><div className="calendar-head"><div><span className="eyebrow">Workflow calendar</span><h2>{monthNames[month.getMonth()]} {month.getFullYear()}</h2></div><div><button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><button aria-label="Today" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button><button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div></div><div className="calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <b key={day}>{day}</b>)}</div><div className="calendar-grid large-calendar-grid">{days.map(date => <div key={date.toISOString()} className={`${date.getMonth() !== month.getMonth() ? 'outside' : ''} ${dateKey(date) === dateKey(today) ? 'today' : ''}`}><span>{date.getDate()}</span>{eventsFor(date).slice(0, 3).map(event => <button key={event.id} className={eventType[event.type] || 'data'} onClick={() => setEventDetail(event)}>{typeLabel(event.type)}{event.trialId ? ` · ${event.trialId}` : ''}</button>)}</div>)}</div>{!events.length && <div className="calendar-empty">No workflow events yet. Activity will appear here as you use the fictional demo.</div>}{eventDetail && <div className="calendar-detail"><b>{eventDetail.title}</b><p>{eventDetail.participantId ? `${eventDetail.participantId} · ` : ''}{eventDetail.trialId || 'Workflow event'}{eventDetail.publicSite ? ` · ${eventDetail.publicSite}` : ''}</p><small>{new Date(eventDetail.timestamp).toLocaleString()}</small><div><button className="link-btn" onClick={() => location.assign(eventDetail.href || '/researcher/dashboard')}>Open workspace →</button><button className="link-btn" onClick={() => setEventDetail(null)}>Close</button></div></div>}</article>
      <aside className="dashboard-today"><article className="operations-card"><span className="eyebrow">Today / upcoming</span><h2>Tasks</h2>{tasks.length ? <div className="attention-list">{tasks.map(task => <button key={task.text} onClick={() => location.assign(task.href)}><span className="event-dot ai"/><div><b>{task.text}</b><small>{task.count} active workflow item{task.count === 1 ? '' : 's'}</small></div><em>Open →</em></button>)}</div> : <div className="task-empty">No active workflow tasks. Start in Screening to begin a fictional recruitment cycle.</div>}</article><article className="operations-card recent-card"><span className="eyebrow">Recent activity</span><h2>Latest workflow events</h2>{events.length ? events.slice(0, 8).map(event => <button key={event.id} onClick={() => location.assign(event.href || '/researcher/dashboard')}><span className={`event-dot ${eventType[event.type] || 'data'}`}/><div><b>{event.title}</b><small>{event.participantId ? `${event.participantId} · ` : ''}{event.trialId || 'Workspace'} · {new Date(event.timestamp).toLocaleString()}</small></div></button>) : <div className="task-empty">Activity appears here after you use the workflow.</div>}</article></aside>
    </section>
    <section className="dashboard-lower"><article className="operations-card pipeline-card"><div><span className="eyebrow">Recruitment pipeline</span><h2>Current workflow</h2></div>{pipeline.every(([, value]) => value === 0) ? <div className="task-empty">No active workflow records yet.</div> : pipeline.map(([label, value, href]) => <button className="pipeline-line" key={label} onClick={() => location.assign(href)}><span>{label}</span><i><b style={{ width: `${value / max * 100}%` }}/></i><strong>{value}</strong></button>)}</article><article className="operations-card activity-card"><span className="eyebrow">Workflow summary</span><h2>Current activity</h2><dl><div><dt>Ready to review</dt><dd>{counts.ready}</dd></div><div><dt>Scheduled outreach</dt><dd>{counts.scheduled}</dd></div><div><dt>Completed cycles</dt><dd>{counts.archives}</dd></div></dl><button className="btn secondary" onClick={() => location.assign('/researcher/outreach')}>Open Outreach Center</button></article></section>
  </main></div>;
}
