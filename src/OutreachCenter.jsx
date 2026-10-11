import React, { useEffect, useMemo, useState } from 'react';
import { getClinicalTrial } from './services/clinicalTrials';
import { patients } from './ExplainableMatchDemo';
import WorkplaceBadge from './WorkplaceBadge';
import { profileName, resetActiveRecruitmentWorkflow } from './recruitmentWorkflow';
import { clearFinalistSelections, finalistEvent, readFinalistSelections } from './finalistSelections';
import './outreach-center.css';

const STUDY_IDS = ['NCT05564039', 'NCT05025787', 'NCT04791371'];
const HISTORY_KEY = 'vitra-outreach-history-v1';
const ARCHIVE_KEY = 'vitra-completed-recruitment-cycles-v1';
const FOLDERS = ['All outreach', 'Draft created', 'Ready to review', 'Scheduled', 'Simulated sent', 'Delivered', 'Responded', 'Opted out', 'Failed delivery', 'Templates'];
const COMPLETION_STATUSES = new Set(['Simulated sent', 'Delivered', 'Responded', 'Opted out']);
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; } };

export default function OutreachCenter({ Sidebar }) {
  const [studies, setStudies] = useState([]);
  const [history, setHistory] = useState(() => readJson(HISTORY_KEY, {}));
  const [finalists, setFinalists] = useState(readFinalistSelections);
  const [folder, setFolder] = useState('All outreach');
  const [selected, setSelected] = useState(null);
  const [channel, setChannel] = useState('Email');
  const [preview, setPreview] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archives, setArchives] = useState(() => readJson(ARCHIVE_KEY, []));

  useEffect(() => {
    let active = true;
    Promise.all(STUDY_IDS.map(getClinicalTrial)).then(rows => active && setStudies(rows));
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const sync = () => setFinalists(readFinalistSelections());
    window.addEventListener(finalistEvent, sync);
    return () => window.removeEventListener(finalistEvent, sync);
  }, []);

  const recipients = useMemo(() => Object.values(finalists).map(item => {
    const profile = patients.find(person => person.profile_id === item.profileId);
    const study = studies.find(record => record.nctId === item.trialId);
    const key = [item.researcherId, item.profileId, item.trialId, item.publicSite].join('::');
    const eligible = profile?.demo_consent && item.availability === 'Available' && item.deterministicOutcome === 'Potential Match';
    return { item, profile, study, key, eligible, status: eligible ? (history[key]?.status || item.outreachDraftStatus || 'Draft created') : 'Draft disabled' };
  }), [studies, history, finalists]);
  const visible = recipients.filter(row => folder === 'All outreach' || folder === 'Templates' || row.status === folder);
  const active = recipients.find(row => row.key === selected) || visible[0];
  const canCompleteCycle = recipients.some(row => COMPLETION_STATUSES.has(row.status));
  const completionSummary = {
    finalists: recipients.length,
    trials: [...new Set(recipients.map(row => row.item.trialId))],
    sites: [...new Set(recipients.map(row => row.item.publicSite))],
    statuses: recipients.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }), {}),
  };

  function message(row = active) {
    if (!row) return '';
    return `Hello ${profileName(row.profile)},\n\nYou may be interested in learning more about ${row.study?.title || row.item.trialId} (${row.item.trialId}). This is not a confirmation of eligibility or enrollment. The approved study team will explain the study and complete any required screening.\n\nParticipation is voluntary. You may opt out of further contact.`;
  }
  function record(status) {
    if (!active || !active.eligible) return;
    const now = new Date().toISOString();
    const next = { ...history, [active.key]: { status, channel, at: now, events: [...(history[active.key]?.events || []), { status, channel, at: now, operator: 'Researcher demo workspace' }] } };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
    setPreview(false);
  }
  function completeCycle() {
    const completedAt = new Date().toISOString();
    const cycle = {
      id: `CYCLE-${Date.now().toString(36).toUpperCase()}`,
      researcherId: recipients[0]?.item.researcherId || 'demo-researcher',
      completedAt,
      fictional: true,
      finalists: recipients.map(row => ({
        syntheticParticipantId: row.item.profileId,
        fictionalName: profileName(row.profile),
        nctId: row.item.trialId,
        trialTitle: row.item.trialTitle,
        publicSite: row.item.publicSite,
        deterministicOutcome: row.item.deterministicOutcome,
        requirementCounts: row.item.counts,
        simulatedOutreachStatus: row.status,
        simulatedOutreachHistory: history[row.key]?.events || [],
      })),
    };
    const nextArchives = [cycle, ...archives];
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(nextArchives));
    localStorage.removeItem(HISTORY_KEY);
    clearFinalistSelections();
    resetActiveRecruitmentWorkflow();
    sessionStorage.setItem('vitra-cycle-reset-notice', 'Simulated outreach cycle completed. Active recruitment workflow has been reset. Archived demo history is available in Outreach Center.');
    location.assign('/researcher/screening');
  }

  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main outreach-center">
    <div className="page-head"><div><span className="eyebrow">Final Matches · simulated outreach</span><h1>Outreach Center</h1><p>Automatically generated fictional drafts for selected Final Matches, separated by trial and public study-site context.</p></div><div className="outreach-header"><WorkplaceBadge/><button className="btn secondary" onClick={() => setArchiveOpen(true)}>Completed cycles ({archives.length})</button><button className="btn" onClick={() => setPreview(true)} disabled={!active || !active.eligible}>Preview simulated outreach</button></div></div>
    <div className="notice"><span><b>Demo outreach only.</b> Messages are simulated and are not sent to real participants. Final study eligibility and enrollment are determined by the approved study team.</span></div>
    {canCompleteCycle && <section className="cycle-completion-card"><div><span className="eyebrow">Cycle control</span><h2>Complete simulated outreach cycle</h2><p>Archive this fictional cycle and clear active Screening, AI Fit Review, Final Matches, and outreach drafts. Your workplace context and public study records stay unchanged.</p></div><button className="btn" onClick={() => setConfirmReset(true)}>Complete cycle</button></section>}
    <section className="outreach-layout"><aside className="outreach-folders">{FOLDERS.map(name => <button key={name} className={folder === name ? 'active' : ''} onClick={() => setFolder(name)}>{name}<b>{name === 'Templates' ? 5 : recipients.filter(row => name === 'All outreach' || row.status === name).length}</b></button>)}</aside><section className="outreach-list"><div className="outreach-list-head"><h2>Final Match recipients</h2><small>Fictional demo contacts only · not deliverable</small></div>{visible.map(row => <button key={row.key} className={`outreach-recipient ${active?.key === row.key ? 'selected' : ''}`} onClick={() => setSelected(row.key)}><span><b>{profileName(row.profile)}</b><small>{row.profile?.profile_id} · {row.item.trialId} · {row.item.publicSite}</small><small>maya.patel.demo@example.test · (555) 010-1234 · fictional demo contact</small></span><em>{row.status}</em></button>)}{!visible.length && <div className="empty">No active fictional finalists. Start a new recruitment cycle from Screening, or open Completed cycles to view archived demo history.</div>}</section><section className="outreach-composer">{active ? <><span className="eyebrow">Automated invitation composer</span><h2>{profileName(active.profile)}</h2><p><b>{active.item.trialId}</b> · {active.study?.title || 'Public study record loading'}</p><p><b>Public site:</b> {active.item.publicSite}</p>{!active.eligible && <div className="form-error">Draft disabled: consent, availability, or deterministic Potential Match requirements no longer pass.</div>}<label>Channel<select value={channel} onChange={event => setChannel(event.target.value)} disabled={!active.eligible}><option>Email</option><option>SMS / text</option><option>Phone-call script</option><option>Secure-portal message</option></select></label><label>Subject<input value="Invitation to learn about a clinical research study" readOnly/></label><label>Message<textarea value={message()} readOnly/></label><small>Fictional demo contact — not deliverable. This is not a confirmation of eligibility. Clinical screening is required.</small><div className="outreach-actions"><button className="btn" disabled={!active.eligible} onClick={() => record('Ready to review')}>Mark ready to review</button><button className="btn secondary" disabled={!active.eligible} onClick={() => record('Simulated sent')}>Send simulated message</button><button className="btn secondary" disabled={!active.eligible} onClick={() => record('Scheduled')}>Schedule</button><button className="btn secondary" disabled={!active.eligible} onClick={() => record('Delivered')}>Mark delivered</button><button className="btn secondary" disabled={!active.eligible} onClick={() => record('Responded')}>Record response</button><button className="btn secondary" disabled={!active.eligible} onClick={() => record('Opted out')}>Record opt-out</button></div>{history[active.key]?.events?.length > 0 && <div className="outreach-history"><h3>Outreach history</h3>{history[active.key].events.map((event, index) => <p key={`${event.at}-${index}`}><b>{event.status}</b> · {event.channel} · {new Date(event.at).toLocaleString()} · {event.operator}</p>)}</div>}</> : <div className="empty">Select a Final Match to prepare simulated outreach.</div>}</section></section>
    {preview && active && <div className="outreach-preview"><h2>Preview: simulated {channel}</h2><pre>{message()}</pre><button className="btn" onClick={() => record('Simulated sent')}>Confirm simulated send</button><button className="btn secondary" onClick={() => setPreview(false)}>Close</button></div>}
    {confirmReset && <div className="cycle-modal" role="dialog" aria-modal="true" aria-labelledby="cycle-modal-title"><section><span className="eyebrow">Confirm fictional cycle completion</span><h2 id="cycle-modal-title">Complete this simulated outreach cycle?</h2><p>This archives the audit summary and clears active workflow records. No real messages are sent.</p><dl><div><dt>Fictional finalists</dt><dd>{completionSummary.finalists}</dd></div><div><dt>Simulated drafts</dt><dd>{recipients.length}</dd></div><div><dt>Trials / NCT IDs</dt><dd>{completionSummary.trials.join(', ')}</dd></div><div><dt>Public study sites</dt><dd>{completionSummary.sites.join(' · ')}</dd></div><div><dt>Current statuses</dt><dd>{Object.entries(completionSummary.statuses).map(([status, count]) => `${status}: ${count}`).join(' · ')}</dd></div><div><dt>Completion time</dt><dd>{new Date().toLocaleString()}</dd></div></dl><div className="outreach-actions"><button className="btn" onClick={completeCycle}>Archive and reset active cycle</button><button className="btn secondary" onClick={() => setConfirmReset(false)}>Cancel</button></div></section></div>}
    {archiveOpen && <div className="cycle-modal" role="dialog" aria-modal="true" aria-labelledby="archive-modal-title"><section className="archive-modal"><span className="eyebrow">Read-only archive</span><h2 id="archive-modal-title">Completed fictional cycles</h2>{archives.length ? archives.map(cycle => <article key={cycle.id}><b>{cycle.id}</b><small>{new Date(cycle.completedAt).toLocaleString()} · {cycle.researcherId} · fictional synthetic demo data</small>{cycle.finalists.map(item => <p key={`${cycle.id}-${item.syntheticParticipantId}-${item.nctId}`}><b>{item.fictionalName}</b> · {item.syntheticParticipantId} · {item.nctId} · {item.publicSite}<br/><small>{item.deterministicOutcome} · {item.simulatedOutreachStatus} · MET {item.requirementCounts?.MET ?? 0}, NOT MET {item.requirementCounts?.['NOT MET'] ?? 0}, UNKNOWN {item.requirementCounts?.UNKNOWN ?? 0}</small></p>)}</article>) : <p>No completed fictional recruitment cycles yet.</p>}<button className="btn secondary" onClick={() => setArchiveOpen(false)}>Close archive</button></section></div>}
  </main></div>;
}
