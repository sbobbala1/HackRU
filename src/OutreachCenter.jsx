import React, { useEffect, useMemo, useState } from 'react';
import { getClinicalTrial } from './services/clinicalTrials';
import { patients } from './ExplainableMatchDemo';
import WorkplaceBadge from './WorkplaceBadge';
import { profileName, resetActiveRecruitmentWorkflow, screeningSourceStatus } from './recruitmentWorkflow';
import { clearFinalistSelections, finalistEvent, readFinalistSelections } from './finalistSelections';
import './outreach-center.css';

const STUDY_IDS = ['NCT05564039', 'NCT05025787', 'NCT04791371'];
const HISTORY_KEY = 'vitra-outreach-history-v1';
const ARCHIVE_KEY = 'vitra-completed-recruitment-cycles-v1';
const COMPLETION_STATUSES = new Set(['Sent', 'Simulated sent', 'Delivered', 'Responded', 'Opted out']);
const FOLDERS = ['All outreach', 'Drafts', 'Ready to review', 'Screening follow-up', 'Sent', 'Scheduled', 'Delivered', 'Responded', 'Opted out'];
const CHANNELS = ['Email', 'SMS / text', 'Phone-call script', 'Secure-portal message'];
const TEMPLATES = {
  'Screening follow-up reminder': { purpose: 'Screening follow-up', subject: 'Next step for your research-study screening', body: row => `Hello ${profileName(row.profile)},\n\nThank you for your interest in learning about ${row.item.trialTitle} (${row.item.trialId}). The study team may need to complete or continue the screening process before any participation decision can be made.\n\nPublic study site: ${row.item.publicSite}\nStudy-team contact: research-team@example.test\n\nParticipation is voluntary. Screening does not guarantee eligibility or enrollment. You may opt out of further contact.` },
  'Screening appointment / next-step reminder': { purpose: 'Screening follow-up', subject: 'Reminder: research-study screening next step', body: row => `Hello ${profileName(row.profile)},\n\nPlease contact the study team about the next screening step for ${row.item.trialTitle} (${row.item.trialId}).\n\nPublic study site: ${row.item.publicSite}\nStudy-team contact: research-team@example.test\n\nParticipation is voluntary, and this message does not confirm eligibility or enrollment.` },
  'Missing-information follow-up': { purpose: 'Screening follow-up', subject: 'Study-team follow-up may be needed', body: row => `Hello ${profileName(row.profile)},\n\nThe study team may need additional information before continuing the screening process for ${row.item.trialTitle} (${row.item.trialId}).\n\nPlease contact the study team at research-team@example.test if you would like to learn more. This does not confirm eligibility or enrollment.` },
  'Study-team contact reminder': { purpose: 'Screening follow-up', subject: 'Contact the study team to learn more', body: row => `Hello ${profileName(row.profile)},\n\nIf you would like to learn more about ${row.item.trialTitle} (${row.item.trialId}), the study team can explain the study and any screening next steps.\n\nPublic study site: ${row.item.publicSite}\nStudy-team contact: research-team@example.test\n\nParticipation is voluntary. Screening does not guarantee eligibility or enrollment.` },
  'Screening no-longer-needed notice': { purpose: 'General outreach', subject: 'Update about research-study follow-up', body: row => `Hello ${profileName(row.profile)},\n\nNo additional outreach is currently planned for ${row.item.trialTitle} (${row.item.trialId}). This is not a medical decision or an enrollment notice.\n\nYou may opt out of further contact at any time.` },
  'General study invitation': { purpose: 'General outreach', subject: 'Invitation to learn about a clinical research study', body: row => `Hello ${profileName(row.profile)},\n\nYou may be interested in learning more about ${row.item.trialTitle} (${row.item.trialId}). The approved study team can explain the study and any required screening.\n\nParticipation is voluntary. This is not a confirmation of eligibility or enrollment.` },
};
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; } };
const displayStatus = status => status === 'Simulated sent' ? 'Sent' : status;
const folderMatches = (row, folder) => folder === 'All outreach' || folder === 'Drafts' && row.status === 'Draft created' || folder === 'Screening follow-up' && row.screeningFollowUp && !COMPLETION_STATUSES.has(row.status) || displayStatus(row.status) === folder;
const priority = row => row.screeningFollowUp && !COMPLETION_STATUSES.has(row.status) ? 0 : ({ 'Ready to review': 1, Scheduled: 2, 'Draft created': 3, Sent: 4, 'Simulated sent': 4, Delivered: 5, Responded: 6, 'Opted out': 7 }[row.status] ?? 8);

export default function OutreachCenter({ Sidebar }) {
  const [studies, setStudies] = useState([]);
  const [history, setHistory] = useState(() => readJson(HISTORY_KEY, {}));
  const [finalists, setFinalists] = useState(readFinalistSelections);
  const [folder, setFolder] = useState('All outreach');
  const [selected, setSelected] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [query, setQuery] = useState('');
  const [trialFilter, setTrialFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [channel, setChannel] = useState('Email');
  const [template, setTemplate] = useState('Screening follow-up reminder');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archives] = useState(() => readJson(ARCHIVE_KEY, []));
  const [bulkNotice, setBulkNotice] = useState('');

  useEffect(() => { let alive = true; Promise.all(STUDY_IDS.map(getClinicalTrial)).then(rows => alive && setStudies(rows)); return () => { alive = false; }; }, []);
  useEffect(() => { const sync = () => setFinalists(readFinalistSelections()); window.addEventListener(finalistEvent, sync); return () => window.removeEventListener(finalistEvent, sync); }, []);

  const recipients = useMemo(() => Object.values(finalists).map(item => {
    const profile = patients.find(person => person.profile_id === item.profileId);
    const study = studies.find(record => record.nctId === item.trialId);
    const key = [item.researcherId, item.profileId, item.trialId, item.publicSite].join('::');
    const record = history[key] || {};
    const eligible = profile?.demo_consent && item.availability === 'Available' && item.deterministicOutcome === 'Potential Match' && record.status !== 'Opted out';
    const screeningStatus = screeningSourceStatus(item.trialId, profile);
    const screeningFollowUp = item.outreachDraftType === 'screening-follow-up' && !COMPLETION_STATUSES.has(record.status || item.outreachDraftStatus);
    return { item, profile, study, key, record, eligible, screeningStatus, screeningFollowUp, status: eligible ? (record.status || item.outreachDraftStatus || 'Draft created') : 'Draft disabled', channel: record.channel || 'Email', template: record.template || (screeningFollowUp ? 'Screening follow-up reminder' : 'General study invitation') };
  }).sort((a, b) => priority(a) - priority(b) || a.item.trialId.localeCompare(b.item.trialId) || profileName(a.profile).localeCompare(profileName(b.profile))), [studies, history, finalists]);
  const filtered = recipients.filter(row => folderMatches(row, folder) && (trialFilter === 'all' || row.item.trialId === trialFilter) && (channelFilter === 'all' || row.channel === channelFilter) && (!query.trim() || `${profileName(row.profile)} ${row.item.trialId} ${row.item.trialTitle} ${row.item.publicSite}`.toLowerCase().includes(query.toLowerCase())));
  const active = recipients.find(row => row.key === selected) || filtered[0] || recipients[0];
  const canCompleteCycle = recipients.some(row => COMPLETION_STATUSES.has(row.status));
  const selection = recipients.filter(row => selectedRows.includes(row.key));

  useEffect(() => {
    if (!active) { setSubject(''); setBody(''); return; }
    const nextTemplate = active.template;
    const nextChannel = active.channel;
    const draft = active.record.drafts?.[nextChannel];
    setTemplate(nextTemplate);
    setChannel(nextChannel);
    setSubject(draft?.subject || TEMPLATES[nextTemplate].subject);
    setBody(draft?.body || TEMPLATES[nextTemplate].body(active));
    setScheduledFor(active.record.scheduledFor ? active.record.scheduledFor.slice(0, 16) : '');
  }, [active?.key]);
  useEffect(() => {
    if (!active) return;
    const draft = active.record.drafts?.[channel];
    setSubject(draft?.subject || TEMPLATES[template].subject);
    setBody(draft?.body || TEMPLATES[template].body(active));
  }, [channel]);
  function persist(next) { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); setHistory(next); }
  function updateActiveDraft(overrides = {}) {
    if (!active || !active.eligible) return;
    const now = new Date().toISOString();
    const previous = history[active.key] || {};
    persist({ ...history, [active.key]: { ...previous, status: previous.status || 'Draft created', channel, template, updatedAt: now, drafts: { ...(previous.drafts || {}), [channel]: { subject, body, template, updatedAt: now } }, ...overrides } });
  }
  function chooseTemplate(nextTemplate) { setTemplate(nextTemplate); setSubject(TEMPLATES[nextTemplate].subject); setBody(TEMPLATES[nextTemplate].body(active)); }
  function record(status, target = active) {
    if (!target || !target.eligible) return;
    const now = new Date().toISOString();
    const previous = history[target.key] || {};
    const draftSubject = target.key === active?.key ? subject : TEMPLATES[target.template].subject;
    const draftBody = target.key === active?.key ? body : TEMPLATES[target.template].body(target);
    const scheduledAt = status === 'Scheduled' && target.key === active?.key && scheduledFor ? new Date(scheduledFor).toISOString() : previous.scheduledFor;
    persist({ ...history, [target.key]: { ...previous, status, channel: target.key === active?.key ? channel : target.channel, template: target.key === active?.key ? template : target.template, at: now, scheduledFor: scheduledAt, drafts: { ...(previous.drafts || {}), [target.key === active?.key ? channel : target.channel]: { subject: draftSubject, body: draftBody, template: target.key === active?.key ? template : target.template, updatedAt: now } }, events: [...(previous.events || []), { status, channel: target.key === active?.key ? channel : target.channel, at: now, scheduledFor: scheduledAt, operator: 'Researcher workspace' }] } });
  }
  function toggleSelection(key) { setSelectedRows(rows => rows.includes(key) ? rows.filter(item => item !== key) : [...rows, key]); }
  function applyBulk(status) { const valid = selection.filter(row => row.eligible); valid.forEach(row => record(status, row)); setBulkNotice(valid.length ? `${valid.length} draft${valid.length === 1 ? '' : 's'} marked ${status.toLowerCase()}.` : 'Select at least one eligible recipient first.'); }
  function applyBulkTemplate() { const valid = selection.filter(row => row.eligible); const now = new Date().toISOString(); const next = { ...history }; valid.forEach(row => { const previous = next[row.key] || {}; next[row.key] = { ...previous, status: previous.status || 'Draft created', channel: row.channel, template, drafts: { ...(previous.drafts || {}), [row.channel]: { subject: TEMPLATES[template].subject, body: TEMPLATES[template].body(row), template, updatedAt: now } }, updatedAt: now }; }); persist(next); setBulkNotice(valid.length ? `${template} applied to ${valid.length} draft${valid.length === 1 ? '' : 's'}.` : 'Select at least one eligible recipient first.'); }
  function completeCycle() {
    const completedAt = new Date().toISOString();
    const cycle = { id: `CYCLE-${Date.now().toString(36).toUpperCase()}`, researcherId: recipients[0]?.item.researcherId || 'demo-researcher', completedAt, fictional: true, finalists: recipients.map(row => ({ syntheticParticipantId: row.item.profileId, fictionalName: profileName(row.profile), nctId: row.item.trialId, trialTitle: row.item.trialTitle, publicSite: row.item.publicSite, deterministicOutcome: row.item.deterministicOutcome, requirementCounts: row.item.counts, simulatedOutreachStatus: row.status, simulatedOutreachHistory: row.record.events || [] })) };
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify([cycle, ...archives])); localStorage.removeItem(HISTORY_KEY); clearFinalistSelections(); resetActiveRecruitmentWorkflow(); sessionStorage.setItem('vitra-cycle-reset-notice', 'Outreach cycle completed. Active recruitment workflow has been reset. Archived history is available in Outreach Center.'); location.assign('/researcher/screening');
  }
  const summary = { finalists: recipients.length, trials: [...new Set(recipients.map(row => row.item.trialId))], sites: [...new Set(recipients.map(row => row.item.publicSite))], statuses: recipients.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }), {}) };

  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main outreach-center">
    <div className="page-head"><div><span className="eyebrow">Final Matches</span><h1>Outreach Center</h1></div><div className="outreach-header"><WorkplaceBadge/><button className="btn secondary" onClick={() => setArchiveOpen(true)}>Completed cycles ({archives.length})</button></div></div>
    <section className="outreach-layout"><aside className="outreach-folders"><button className="compose-simulated" disabled={!active?.eligible} onClick={() => { setSelected(active?.key || null); updateActiveDraft(); }}>＋ Compose message</button>{FOLDERS.map(name => <button key={name} className={folder === name ? 'active' : ''} onClick={() => setFolder(name)}>{name}<b>{recipients.filter(row => folderMatches(row, name)).length}</b></button>)}<button onClick={() => setArchiveOpen(true)}>Archived cycles <b>{archives.length}</b></button></aside>
      <section className="outreach-list"><div className="outreach-list-head"><div><h2>Final Match recipients</h2></div><input aria-label="Search outreach" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people, NCT ID, site…"/></div><div className="outreach-filters"><select value={trialFilter} onChange={event => setTrialFilter(event.target.value)}><option value="all">All trials</option>{[...new Set(recipients.map(row => row.item.trialId))].map(id => <option key={id}>{id}</option>)}</select><select value={channelFilter} onChange={event => setChannelFilter(event.target.value)}><option value="all">All channels</option>{CHANNELS.map(item => <option key={item}>{item}</option>)}</select><span>{filtered.length} shown</span></div>{selection.length > 0 && <div className="bulk-actions"><b>{selection.length} selected</b><button onClick={() => applyBulk('Ready to review')}>Mark ready</button><button onClick={() => applyBulk('Scheduled')}>Schedule</button><button onClick={applyBulkTemplate}>Apply template</button></div>}{bulkNotice && <div className="success bulk-notice">{bulkNotice}</div>}{filtered.map(row => <article key={row.key} className={`outreach-recipient ${active?.key === row.key ? 'selected' : ''}`}><label className="recipient-check"><input type="checkbox" checked={selectedRows.includes(row.key)} onChange={() => toggleSelection(row.key)}/><span/></label><button onClick={() => setSelected(row.key)}><span className="needs-action">{row.screeningFollowUp && !COMPLETION_STATUSES.has(row.status) ? 'Needs screening follow-up' : displayStatus(row.status)}</span><b>{profileName(row.profile)}</b><small>{row.profile?.profile_id} · {row.item.trialId} · {row.item.publicSite}</small><small>{row.item.trialTitle}</small><span className="recipient-meta"><em>{row.channel}</em><time>{row.record.scheduledFor ? new Date(row.record.scheduledFor).toLocaleString() : row.record.updatedAt || row.item.selectedAt ? new Date(row.record.updatedAt || row.item.selectedAt).toLocaleDateString() : 'New draft'}</time></span></button></article>)}{!filtered.length && <div className="empty">No active drafts match this view. Start a new recruitment cycle from Screening, or review a completed cycle archive.</div>}</section>
      <section className="outreach-composer">{active ? <><span className="eyebrow">Outreach message</span><h2>{profileName(active.profile)}</h2><p><b>{active.item.trialId}</b> · {active.study?.title || active.item.trialTitle}</p><div className="outreach-facts"><span><b>Public site</b>{active.item.publicSite}</span><span><b>Consent / availability</b>{active.profile?.demo_consent ? 'Consent recorded' : 'No consent'} · {active.item.availability}</span><span><b>Screening workflow</b>{active.screeningStatus}</span><span><b>Fit review</b>Potential Match</span></div>{!active.eligible && <div className="form-error">Draft disabled: consent, availability, review outcome, or opt-out status no longer permits outreach.</div>}<label>Channel<select value={channel} onChange={event => setChannel(event.target.value)} disabled={!active.eligible}>{CHANNELS.map(item => <option key={item}>{item}</option>)}</select></label><label>Message template<select value={template} onChange={event => chooseTemplate(event.target.value)} disabled={!active.eligible}>{Object.keys(TEMPLATES).map(item => <option key={item}>{item}</option>)}</select></label><p className="channel-note">{channel === 'SMS / text' ? `${body.length} characters` : channel === 'Phone-call script' ? 'Call script' : channel}</p><label>Subject<input value={subject} onChange={event => setSubject(event.target.value)} disabled={!active.eligible}/></label><label>Message<textarea value={body} onChange={event => setBody(event.target.value)} disabled={!active.eligible}/></label><label>Send date & time<input type="datetime-local" value={scheduledFor} onChange={event => setScheduledFor(event.target.value)} disabled={!active.eligible}/></label><div className="outreach-actions"><button className="btn secondary" disabled={!active.eligible} onClick={updateActiveDraft}>Save draft</button><button className="btn" disabled={!active.eligible} onClick={() => record('Sent')}>Send</button><button className="btn secondary" disabled={!active.eligible || !scheduledFor} onClick={() => record('Scheduled')}>Schedule</button><button className="btn secondary" disabled={!active.eligible} onClick={() => record('Opted out')}>Record opt-out</button></div>{active.record.events?.length > 0 && <div className="outreach-history"><h3>Outreach history</h3>{active.record.events.map((event, index) => <p key={`${event.at}-${index}`}><b>{displayStatus(event.status)}</b> · {event.channel} · {event.scheduledFor ? `Scheduled for ${new Date(event.scheduledFor).toLocaleString()} · ` : ''}{new Date(event.at).toLocaleString()} · {event.operator}</p>)}</div>}<div className="channel-drafts"><b>Saved channel drafts</b>{Object.entries(active.record.drafts || {}).length ? Object.entries(active.record.drafts).map(([draftChannel, draft]) => <p key={draftChannel}><b>{draftChannel}</b> · {draft.template} · {new Date(draft.updatedAt).toLocaleString()}</p>) : <p>No saved channel drafts yet.</p>}</div></> : <div className="empty">Select a Final Match to prepare outreach.</div>}</section></section>
    {canCompleteCycle && <section className="cycle-completion-card"><button className="btn" onClick={() => setConfirmReset(true)}>Complete outreach cycle</button></section>}
    {confirmReset && <div className="cycle-modal" role="dialog" aria-modal="true" aria-labelledby="cycle-modal-title"><section><span className="eyebrow">Confirm cycle completion</span><h2 id="cycle-modal-title">Complete this outreach cycle?</h2><p>This archives the activity summary and clears active workflow records.</p><dl><div><dt>Finalists</dt><dd>{summary.finalists}</dd></div><div><dt>Drafts</dt><dd>{recipients.length}</dd></div><div><dt>Trials / NCT IDs</dt><dd>{summary.trials.join(', ')}</dd></div><div><dt>Public study sites</dt><dd>{summary.sites.join(' · ')}</dd></div><div><dt>Current statuses</dt><dd>{Object.entries(summary.statuses).map(([status, count]) => `${displayStatus(status)}: ${count}`).join(' · ')}</dd></div><div><dt>Completion time</dt><dd>{new Date().toLocaleString()}</dd></div></dl><div className="outreach-actions"><button className="btn" onClick={completeCycle}>Archive and reset active cycle</button><button className="btn secondary" onClick={() => setConfirmReset(false)}>Cancel</button></div></section></div>}
    {archiveOpen && <div className="cycle-modal" role="dialog" aria-modal="true" aria-labelledby="archive-modal-title"><section className="archive-modal"><span className="eyebrow">Read-only archive</span><h2 id="archive-modal-title">Completed cycles</h2>{archives.length ? archives.map(cycle => <article key={cycle.id}><b>{cycle.id}</b><small>{new Date(cycle.completedAt).toLocaleString()} · {cycle.researcherId}</small>{cycle.finalists.map(item => <p key={`${cycle.id}-${item.syntheticParticipantId}-${item.nctId}`}><b>{item.fictionalName}</b> · {item.syntheticParticipantId} · {item.nctId} · {item.publicSite}<br/><small>{item.deterministicOutcome} · {displayStatus(item.simulatedOutreachStatus)} · MET {item.requirementCounts?.MET ?? 0}, NOT MET {item.requirementCounts?.['NOT MET'] ?? 0}, UNKNOWN {item.requirementCounts?.UNKNOWN ?? 0}</small></p>)}</article>) : <p>No completed recruitment cycles yet.</p>}<button className="btn secondary" onClick={() => setArchiveOpen(false)}>Close archive</button></section></div>}
  </main></div>;
}
