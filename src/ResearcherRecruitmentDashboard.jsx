import React, { useEffect, useMemo, useState } from 'react';
import { getClinicalTrial } from './services/clinicalTrials';
import { api } from './services/api';
import { criteriaText } from './services/demoMode';
import { patients } from './ExplainableMatchDemo';
import './researcher-dashboard.css';

const STUDIES = ['NCT05564039', 'NCT05025787', 'NCT04791371'];
const WORKFLOW = ['Potential Match', 'Needs Review', 'Invited', 'Interested', 'Screening in Progress'];
const STORAGE_KEY = 'vitra-researcher-workflow-v1';

function readWorkflow() {
  try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}
function categoryState(outcome) {
  return outcome === 'Potential Match' ? 'Potential Match' : 'Needs Review';
}
function rowKey(trialId, profileId) { return `${trialId}:${profileId}`; }

export default function ResearcherRecruitmentDashboard({ Sidebar }) {
  const [studies, setStudies] = useState([]);
  const [rankings, setRankings] = useState({});
  const [trialFilter, setTrialFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [missingFilter, setMissingFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('priority');
  const [selectedKey, setSelectedKey] = useState('');
  const [workflow, setWorkflow] = useState(readWorkflow);
  const [showCompare, setShowCompare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const trialRows = await Promise.all(STUDIES.map(getClinicalTrial));
      setStudies(trialRows);
      const ranked = await Promise.all(trialRows.map(async trial => {
        if (!trial.eligibility || trial.eligibility === 'Not provided in the source') return [trial.nctId, []];
        return [trial.nctId, await api.rankEligibility(trial.nctId, trial.studyUrl, criteriaText(trial), patients)];
      }));
      setRankings(Object.fromEntries(ranked));
      const first = trialRows[0];
      const firstMatch = ranked.find(([id]) => id === first.nctId)?.[1]?.[0];
      if (firstMatch) setSelectedKey(rowKey(first.nctId, firstMatch.profile_id));
    } catch (e) {
      setError(`${e.message} Check the Vitra API and ClinicalTrials.gov connection, then retry.`);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(workflow)); } catch { setError('Browser storage is unavailable. Workflow changes cannot be saved.'); } }, [workflow]);

  const allRows = useMemo(() => studies.flatMap(trial => (rankings[trial.nctId] || []).map(result => {
    const profile = patients.find(p => p.profile_id === result.profile_id);
    const saved = workflow[rowKey(trial.nctId, result.profile_id)];
    return { trial, result, profile, key: rowKey(trial.nctId, result.profile_id),
      stage: saved?.stage || categoryState(result.outcome),
      invited: Boolean(saved?.events?.some(e => e.action === 'Invited')),
      events: saved?.events || [] };
  })), [studies, rankings, workflow]);
  const conditions = useMemo(() => [...new Set(allRows.flatMap(r => r.profile?.conditions || []))].sort(), [allRows]);
  const rows = useMemo(() => {
    const filtered = allRows.filter(row =>
      (trialFilter === 'all' || row.trial.nctId === trialFilter) &&
      (conditionFilter === 'all' || row.profile?.conditions?.includes(conditionFilter)) &&
      (categoryFilter === 'all' || row.result.outcome === categoryFilter) &&
      (missingFilter === 'all' || (missingFilter === 'yes' ? row.result.counts?.UNKNOWN > 0 : row.result.counts?.UNKNOWN === 0)) &&
      (!query || row.result.profile_id.toLowerCase().includes(query.toLowerCase())));
    const priority = { 'Potential Match': 0, 'Needs More Information': 1, 'Criteria Conflict': 2 };
    return filtered.sort((a, b) => sort === 'id' ? a.result.profile_id.localeCompare(b.result.profile_id) :
      sort === 'unknown' ? b.result.counts.UNKNOWN - a.result.counts.UNKNOWN :
      priority[a.result.outcome] - priority[b.result.outcome] || a.result.counts.UNKNOWN - b.result.counts.UNKNOWN || b.result.counts.MET - a.result.counts.MET);
  }, [allRows, trialFilter, conditionFilter, categoryFilter, missingFilter, query, sort]);
  const selected = rows.find(r => r.key === selectedKey) || rows[0] || null;
  const activeRows = trialFilter === 'all' ? allRows : allRows.filter(r => r.trial.nctId === trialFilter);
  const conflicts = activeRows.filter(r => r.result.criteria.some(c => c.section === 'exclusion' && c.status === 'NOT MET')).length;
  const missingCandidates = activeRows.filter(r => r.result.counts?.UNKNOWN > 0).length;
  const stageCounts = Object.fromEntries(WORKFLOW.map(stage => [stage, activeRows.filter(r => r.stage === stage).length]));
  const barrierCounts = activeRows.flatMap(r => r.result.criteria.filter(c => c.status === 'UNKNOWN').map(c => c.criterion))
    .reduce((acc, criterion) => ({ ...acc, [criterion]: (acc[criterion] || 0) + 1 }), {});
  const topBarriers = Object.entries(barrierCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const selectedTrial = studies.find(t => t.nctId === (trialFilter === 'all' ? selected?.trial.nctId : trialFilter));

  function recordAction(row, action, nextStage) {
    if (!row) return;
    if (action === 'Invited' && (!row.profile?.demo_consent || row.invited || row.result.outcome !== 'Potential Match')) return;
    if (action === 'Interested' && (!row.profile?.demo_consent || row.stage !== 'Invited')) return;
    const entry = { action, at: new Date().toISOString(), actor: 'Researcher demo workspace' };
    setWorkflow(old => {
      const prior = old[row.key] || { events: [] };
      if (action === 'Invited' && prior.events.some(e => e.action === 'Invited')) return old;
      return { ...old, [row.key]: { stage: nextStage || action, events: [...prior.events, entry] } };
    });
  }
  function updateStage(row, stage) {
    if (stage === 'Invited') return recordAction(row, 'Invited', 'Invited');
    if (stage === 'Interested' && !row.events.some(e => e.action === 'Interested')) return recordAction(row, 'Interested', stage);
    if (stage === 'Screening in Progress' && row.stage !== 'Interested') return;
    recordAction(row, stage, stage);
  }
  function resetWorkflow() {
    localStorage.removeItem(STORAGE_KEY);
    setWorkflow({});
  }

  if (loading) return <div className="portal"><Sidebar role="researcher"/><main className="portal-main"><div className="researcher-loading" role="status">Loading official study records and evaluating fictional profiles…</div></main></div>;
  if (error) return <div className="portal"><Sidebar role="researcher"/><main className="portal-main"><div className="page-head"><div><span className="eyebrow">Researcher workspace</span><h1>Recruitment dashboard</h1></div></div><div className="researcher-error" role="alert"><b>Dashboard data could not be loaded.</b><p>{error}</p><button className="btn" onClick={load}>Retry</button></div></main></div>;

  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main researcher-dashboard">
    <div className="page-head"><div><span className="eyebrow">Researcher workspace · live public studies + fictional candidates</span><h1>Recruitment dashboard</h1><p>Review source-linked studies, criterion-level matching evidence, and synthetic recruitment workflow activity.</p></div><div className="researcher-header-actions"><button className="btn" onClick={() => location.assign('/researcher/ai-fit-review')}>AI Fit Review</button><button className="btn secondary" onClick={() => setShowCompare(v => !v)}>{showCompare ? 'Hide trial comparison' : 'Compare trials'}</button><button className="btn secondary" onClick={resetWorkflow}>Reset demo workflow</button></div></div>
    <div className="notice"><span><b>Synthetic demo workspace.</b> Trial records are real public ClinicalTrials.gov records; every patient profile and workflow action is fictional and stored in this browser. No candidate is declared eligible. No one is contacted and no medical information is sent externally.</span></div>
    <section className="researcher-study-overview">
      <div className="researcher-study-picker"><label>Study<select aria-label="Trial filter" value={trialFilter} onChange={e => { setTrialFilter(e.target.value); setSelectedKey(''); }}><option value="all">All three official studies</option>{studies.map(t => <option key={t.nctId} value={t.nctId}>{t.nctId} · {t.title}</option>)}</select></label>
      {selectedTrial && <><span className="researcher-study-status">{selectedTrial.status.replaceAll('_', ' ')}</span><h2>{selectedTrial.title}</h2><p><b>{selectedTrial.nctId}</b> · {selectedTrial.source} · {selectedTrial.retrievedAt} · {selectedTrial.conditions.join(', ') || 'Condition not provided'}</p><p>{selectedTrial.summary}</p><a href={selectedTrial.studyUrl} target="_blank" rel="noreferrer">Open official ClinicalTrials.gov record ↗</a><details><summary>Eligibility criteria from the source</summary><pre>{selectedTrial.eligibility || 'Eligibility text not provided in the source.'}</pre></details></>}
      </div>
      <div className="researcher-summary-metrics"><article><span>Patient–study pairs ranked</span><b>{activeRows.length}</b><small>Derived from current study results</small></article><article><span>Known exclusion conflicts</span><b>{conflicts}</b><small>Candidate rows with NOT MET exclusion criteria</small></article><article><span>Missing-data barriers</span><b>{missingCandidates}</b><small>Candidates with one or more UNKNOWN criteria</small></article></div>
    </section>
    {showCompare && <section className="researcher-compare"><div><span className="eyebrow">Official record comparison</span><h2>Eligibility criteria by study</h2><p>Original criteria text is shown as retrieved. Differences are not normalized into clinical equivalence.</p></div><div className="researcher-compare-grid">{studies.map(t => <article key={t.nctId}><h3>{t.title}</h3><b>{t.nctId} · {t.status.replaceAll('_', ' ')}</b><p>{t.conditions.join(', ')}</p><details open><summary>View source eligibility criteria</summary><pre>{t.eligibility || 'Not provided'}</pre></details><a href={t.studyUrl} target="_blank" rel="noreferrer">Source record ↗</a></article>)}</div></section>}
    <section className="researcher-analytics-grid"><article className="researcher-chart"><h2>Recruitment pipeline</h2><p>Candidate counts for {selectedTrial?.nctId || 'all loaded trials'} · all data synthetic</p>{WORKFLOW.map(stage => <div className="pipeline-row" key={stage}><span>{stage}</span><div><i style={{ width: `${activeRows.length ? Math.max(stageCounts[stage] / activeRows.length * 100, stageCounts[stage] ? 4 : 0) : 0}%` }}/></div><b>{stageCounts[stage]}</b></div>)}</article><article className="researcher-chart"><h2>Missing-data barriers</h2><p>UNKNOWN criterion occurrences from current rule-engine results</p>{topBarriers.length ? topBarriers.map(([barrier, count]) => <div className="pipeline-row" key={barrier}><span title={barrier}>{barrier}</span><div><i style={{ width: `${Math.max(count / Math.max(...topBarriers.map(x => x[1])) * 100, 4)}%` }}/></div><b>{count}</b></div>) : <p className="researcher-empty">No unknown criteria in this result set.</p>}<p className="researcher-conflict-note">Known exclusion conflicts: <b>{conflicts}</b> · Candidates with missing information: <b>{missingCandidates}</b></p></article></section>
    <section className="researcher-candidate-area"><div className="researcher-candidate-heading"><div><span className="eyebrow">Synthetic candidate review</span><h2>Potential candidates</h2><p>Fictional patient IDs only. Review categories and UNKNOWN criteria before recording a demo workflow action.</p></div><label>Search patient ID<input value={query} onChange={e => setQuery(e.target.value)} placeholder="SYN-001"/></label></div>
      <div className="researcher-filters"><label>Condition<select value={conditionFilter} onChange={e => setConditionFilter(e.target.value)}><option value="all">All conditions</option>{conditions.map(c => <option key={c}>{c}</option>)}</select></label><label>Match category<select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">All categories</option><option>Potential Match</option><option>Needs More Information</option><option>Criteria Conflict</option></select></label><label>Missing information<select value={missingFilter} onChange={e => setMissingFilter(e.target.value)}><option value="all">Any</option><option value="yes">Has UNKNOWN criteria</option><option value="no">No UNKNOWN criteria</option></select></label><label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}><option value="priority">Review priority</option><option value="unknown">Most unknown criteria</option><option value="id">Patient ID</option></select></label></div>
      <div className="researcher-review-layout"><div className="researcher-table-wrap"><table><thead><tr><th>Patient ID</th><th>Study</th><th>Relevant conditions</th><th>Match category</th><th>Outstanding unknown criteria</th><th>Workflow</th><th>Consent</th></tr></thead><tbody>{rows.map(row => <tr key={row.key} className={selected?.key === row.key ? 'selected-row' : ''} onClick={() => setSelectedKey(row.key)} tabIndex="0" onKeyDown={e => e.key === 'Enter' && setSelectedKey(row.key)}><td><button className="researcher-patient-link">{row.result.profile_id}</button></td><td>{row.trial.nctId}<small>{row.trial.title}</small></td><td>{row.profile?.conditions?.join(', ') || 'Not documented'}</td><td><span className={`researcher-category ${row.result.outcome === 'Potential Match' ? 'good' : row.result.outcome === 'Criteria Conflict' ? 'conflict' : 'review'}`}>{row.result.outcome}</span></td><td>{row.result.missing_information?.length ? row.result.missing_information.join('; ') : row.result.counts.UNKNOWN ? `${row.result.counts.UNKNOWN} criteria need review` : 'None'}</td><td>{row.stage}</td><td>{row.profile?.demo_consent ? 'Demo opt-in' : 'No demo consent'}</td></tr>)}</tbody></table>{!rows.length && <div className="researcher-empty">No candidates match these filters.</div>}</div>
        {selected && <aside className="researcher-review-panel"><div className="review-panel-head"><div><span className="eyebrow">{selected.trial.nctId} · fictional profile</span><h2>{selected.result.profile_id}</h2></div><span className={`researcher-category ${selected.result.outcome === 'Potential Match' ? 'good' : selected.result.outcome === 'Criteria Conflict' ? 'conflict' : 'review'}`}>{selected.result.outcome}</span></div><p><b>Conditions:</b> {selected.profile?.conditions?.join(', ') || 'Not documented'}</p><p><b>Workflow state:</b> {selected.stage}</p><p><b>Counts:</b> MET {selected.result.counts.MET} · NOT MET {selected.result.counts['NOT MET']} · UNKNOWN {selected.result.counts.UNKNOWN}</p><p className="review-disclaimer">Prioritization heuristic only; not a probability or enrollment eligibility decision.</p><div className="review-actions"><label>Record workflow state<select aria-label="Record workflow state" value={selected.stage} onChange={e => updateStage(selected, e.target.value)}>{WORKFLOW.map(s => <option key={s} disabled={s === 'Invited' && (!selected.profile?.demo_consent || selected.invited || selected.result.outcome !== 'Potential Match') || s === 'Interested' && (!selected.profile?.demo_consent || selected.stage !== 'Invited') || s === 'Screening in Progress' && selected.stage !== 'Interested'}>{s}</option>)}</select></label><button className="btn secondary" disabled={!selected.profile?.demo_consent || selected.invited || selected.result.outcome !== 'Potential Match'} onClick={() => recordAction(selected, 'Invited', 'Invited')}>{selected.invited ? 'Invitation already recorded' : 'Record demo invitation'}</button><small>{selected.profile?.demo_consent ? 'Synthetic opt-in is recorded in the demo dataset.' : 'Workflow outreach actions require explicit synthetic demo opt-in.'} Recording an action does not contact anyone.</small></div>
          <h3>Criterion-by-criterion evidence</h3><div className="researcher-criteria-audit">{selected.result.criteria.map(c => <article key={c.criterion_id}><div><b>{c.status}</b><small>{c.section} · {c.logic}</small></div><h4>{c.criterion}</h4><p><b>Source:</b> {c.original_text}</p><p><b>Evidence:</b> {c.profile_evidence}</p><p><b>Reason:</b> {c.explanation}</p>{c.missing_information?.length > 0 && <small>Review needed: {c.missing_information.join('; ')}</small>}</article>)}</div>
          {selected.events.length > 0 && <div className="researcher-action-log"><h3>Researcher action history</h3>{selected.events.map((event, i) => <p key={`${event.at}-${i}`}><b>{event.action}</b> · {new Date(event.at).toLocaleString()} · {event.actor}</p>)}</div>}
        </aside>}
      </div>
    </section>
  </main></div>;
}
