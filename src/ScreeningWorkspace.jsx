import React, { useEffect, useMemo, useState } from 'react';
import { getClinicalTrial } from './services/clinicalTrials';
import { patients } from './ExplainableMatchDemo';
import WorkplaceBadge from './WorkplaceBadge';
import { navigate } from './navigation';
import { AI_REVIEW_EVENT, RECRUITMENT_CYCLE_EVENT, availabilityFor, profileName, readActiveRecruitmentContext, readAiReviewQueue, screeningSourceStatus, setAiReviewReady, shortlistKey } from './recruitmentWorkflow';
import './screening-workspace.css';

const statusClass = status => status.toLowerCase().replace(/[^a-z]+/g, '-');

export default function ScreeningWorkspace({ Sidebar }) {
  const [studies, setStudies] = useState([]);
  const [queue, setQueue] = useState(readAiReviewQueue);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [autoSelect, setAutoSelect] = useState(false);
  const [autoCount, setAutoCount] = useState(3);
  const [genderFilter, setGenderFilter] = useState('all');
  const [autoNotice, setAutoNotice] = useState('');
  const [cycleNotice, setCycleNotice] = useState(() => sessionStorage.getItem('vitra-cycle-reset-notice') || '');
  const [cycleContext, setCycleContext] = useState(readActiveRecruitmentContext);

  useEffect(() => {
    if (!cycleContext?.study?.nctId) { setStudies([]); return undefined; }
    let active = true;
    getClinicalTrial(cycleContext.study.nctId).then(row => active && setStudies([row])).catch(reason => active && setError(reason.message));
    return () => { active = false; };
  }, [cycleContext?.study?.nctId]);
  useEffect(() => { const sync = () => setCycleContext(readActiveRecruitmentContext()); window.addEventListener(RECRUITMENT_CYCLE_EVENT, sync); return () => window.removeEventListener(RECRUITMENT_CYCLE_EVENT, sync); }, []);
  useEffect(() => {
    if (cycleNotice) sessionStorage.removeItem('vitra-cycle-reset-notice');
  }, [cycleNotice]);
  useEffect(() => {
    const sync = () => setQueue(readAiReviewQueue());
    window.addEventListener(AI_REVIEW_EVENT, sync);
    return () => window.removeEventListener(AI_REVIEW_EVENT, sync);
  }, []);

  const cycleStudies = cycleContext?.study?.nctId ? studies.filter(study => study.nctId === cycleContext.study.nctId) : [];
  const cards = useMemo(() => cycleStudies.flatMap(study => patients.map(profile => {
    const sourceStatus = screeningSourceStatus(study.nctId, profile);
    const key = shortlistKey(study.nctId, profile.profile_id);
    const ready = Boolean(queue[key]);
    const eligibleToggle = sourceStatus === 'Screening workflow cleared' && profile.demo_consent && availabilityFor(profile) === 'Available';
    return { study, profile, sourceStatus, ready, eligibleToggle, key };
  })), [cycleStudies, queue]);
  const counts = {
    total: cards.length,
    cleared: cards.filter(row => row.sourceStatus === 'Screening workflow cleared').length,
    followUp: cards.filter(row => row.sourceStatus === 'Needs study-team follow-up').length,
    notAdvancing: cards.filter(row => row.sourceStatus === 'Not advancing').length,
    ready: cards.filter(row => row.ready).length,
  };
  const visible = cards.filter(row => filter === 'all' || filter === 'ready' && row.ready || filter === 'cleared' && row.sourceStatus === 'Screening workflow cleared' || filter === 'follow-up' && row.sourceStatus === 'Needs study-team follow-up' || filter === 'not-advancing' && row.sourceStatus === 'Not advancing');
  const eligibleForAuto = cards.filter(row => row.eligibleToggle && !row.ready && (genderFilter === 'all' || row.profile.gender === genderFilter)).sort((a, b) => `${a.study.nctId}:${a.profile.profile_id}`.localeCompare(`${b.study.nctId}:${b.profile.profile_id}`));

  function toggle(row) {
    if (!row.eligibleToggle) return;
    setAiReviewReady({ trialId: row.study.nctId, profileId: row.profile.profile_id, ready: !row.ready });
    setQueue(readAiReviewQueue());
    setAutoNotice('');
  }
  function addAutomaticSelections() {
    const requested = Math.max(1, Math.min(Number(autoCount) || 1, eligibleForAuto.length));
    const selected = eligibleForAuto.slice(0, requested);
    selected.forEach(row => setAiReviewReady({ trialId: row.study.nctId, profileId: row.profile.profile_id, ready: true }));
    setQueue(readAiReviewQueue());
    setAutoNotice(selected.length ? `${selected.length} cleared, consented, available participant${selected.length === 1 ? '' : 's'} added to the AI Fit Review queue. You can still adjust any record individually below.` : 'No additional participants currently meet the workflow, consent, and availability requirements.');
  }

  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main screening-workspace">
    <div className="page-head"><div><span className="eyebrow">Recruitment workflow · Screening → AI Fit Review → Final Matches</span><h1>Screening</h1><p>Review study-team workflow status, then choose which cleared records are ready for AI Fit Review.</p></div><WorkplaceBadge/></div>
    {!cycleContext && <section className="empty"><h2>Start a new recruitment cycle</h2><p>Choose a public workplace, study site, and active study in Data & Sites before beginning Screening.</p><button className="btn" onClick={() => navigate('/researcher/sites')}>Open Data & Sites</button></section>}
    {cycleContext && <>
    <div className="notice screening-notice"><span><b>Clinical screening is performed by the approved study team.</b> Researchers can review workflow status and source-linked evidence in AI Fit Review.</span></div>
    {error && <div className="form-error">Unable to load public study context: {error}</div>}{cycleNotice && <div className="success">{cycleNotice}</div>}
    <section className="screening-metrics">{[[counts.total,'Workflow records'],[counts.cleared,'Screening workflow cleared'],[counts.followUp,'Needs study-team follow-up'],[counts.notAdvancing,'Not advancing'],[counts.ready,'Ready for AI Fit Review']].map(([value,label]) => <article key={label}><b>{value}</b><span>{label}</span></article>)}</section>
    <section className="screening-controls"><div className="screening-tabs">{[['all','All records'],['cleared','Workflow cleared'],['ready','Ready for AI Fit Review'],['follow-up','Needs follow-up'],['not-advancing','Not advancing']].map(([value,label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div></section>
    <section className="auto-selection-panel"><div><span className="eyebrow">Queue assistant</span><h2>Auto-select cleared participants</h2><p>Choose how many eligible fictional records to add. Only records with read-only screening workflow clearance, fictional consent, and availability can be selected.</p></div><label className="auto-select-toggle"><input type="checkbox" checked={autoSelect} onChange={event => setAutoSelect(event.target.checked)}/><span/><b>Use automatic selection</b></label>{autoSelect && <div className="auto-select-actions"><label>Gender<select value={genderFilter} onChange={event => setGenderFilter(event.target.value)}><option value="all">All genders</option><option value="woman">Women</option><option value="man">Men</option></select></label><label>Participants to add<input type="number" min="1" max={Math.max(1, eligibleForAuto.length)} value={autoCount} onChange={event => setAutoCount(event.target.value)}/></label><button className="btn" disabled={!eligibleForAuto.length} onClick={addAutomaticSelections}>Add {Math.max(1, Number(autoCount) || 1)} to AI Fit Review</button><small>{eligibleForAuto.length} additional record{eligibleForAuto.length === 1 ? '' : 's'} currently eligible for automatic selection.</small></div>}{autoNotice && <div className="success auto-select-notice">{autoNotice}</div>}</section>
    <section className="screening-score-grid">{visible.map(row => <article key={row.key}><span className={`screen-chip ${statusClass(row.sourceStatus)}`}>{row.sourceStatus}</span><h2>{profileName(row.profile)}</h2><small>{row.profile.profile_id} · fictional synthetic participant</small><p><b>{row.study.nctId}</b> · {row.study.title}</p><p><b>Availability:</b> {availabilityFor(row.profile)}<br/><b>Consent:</b> {row.profile.demo_consent ? 'Fictional demo consent recorded' : 'No fictional consent'}</p><p className="screening-source-label">Workflow status supplied by the fictional approved study-team record.</p><label className="ai-ready-toggle"><input type="checkbox" checked={row.ready} disabled={!row.eligibleToggle} onChange={() => toggle(row)}/><span/><div><b>Ready for AI Fit Review</b><small>{row.eligibleToggle ? 'Sends or removes this record from the AI Fit Review queue.' : 'Available only when workflow is cleared, consent is recorded, and the fictional participant is available.'}</small></div></label>{row.ready && <button className="link-btn" onClick={() => { localStorage.setItem('vitra-ai-fit-selection-v1', JSON.stringify({ studyId: row.study.nctId, profileId: row.profile.profile_id })); navigate('/researcher/ai-fit-review'); }}>Open AI Fit Review →</button>}</article>)}</section>
    {!studies.length && !error && <div className="empty">Loading public study workflow context…</div>}{studies.length && !visible.length && <div className="empty">No fictional workflow records match this screening view.</div>}
    </>}
  </main></div>;
}
