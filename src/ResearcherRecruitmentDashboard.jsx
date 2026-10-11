import React, { useEffect, useMemo, useState } from 'react';
import { getClinicalTrial } from './services/clinicalTrials';
import { api } from './services/api';
import { criteriaText } from './services/demoMode';
import { patients } from './ExplainableMatchDemo';
import { availabilityFor, profileName, readActiveRecruitmentContext, readShortlist, saveAiSelection } from './recruitmentWorkflow';
import './researcher-dashboard.css';

const WORKFLOW = ['Ready for AI review', 'Needs screening', 'Shortlisted', 'Not proceeding'];
const STORAGE_KEY = 'vitra-researcher-workflow-v1';

function readWorkflow() {
  try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}
function categoryState(outcome) {
  return outcome === 'Potential Match' ? 'Ready for AI review' : 'Needs screening';
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
  const [shortlist] = useState(readShortlist);
  const [showCompare, setShowCompare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cycleContext] = useState(readActiveRecruitmentContext);

  async function load() {
    setLoading(true); setError('');
    try {
      if (!cycleContext?.study?.nctId) { setStudies([]); setRankings({}); return; }
      const trialRows = [await getClinicalTrial(cycleContext.study.nctId)];
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
  useEffect(() => { load(); }, [cycleContext?.study?.nctId]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(workflow)); } catch { setError('Browser storage is unavailable. Workflow changes cannot be saved.'); } }, [workflow]);

  const allRows = useMemo(() => studies.flatMap(trial => (rankings[trial.nctId] || []).map(result => {
    const profile = patients.find(p => p.profile_id === result.profile_id);
    const saved = workflow[rowKey(trial.nctId, result.profile_id)];
    return { trial, result, profile, key: rowKey(trial.nctId, result.profile_id), shortlist: shortlist[rowKey(trial.nctId, result.profile_id)], availability: availabilityFor(profile),
      stage: saved?.stage || categoryState(result.outcome),
      invited: Boolean(saved?.events?.some(e => e.action === 'Invited')),
      events: saved?.events || [] };
  })), [studies, rankings, workflow, shortlist]);
  const conditions = useMemo(() => [...new Set(allRows.flatMap(r => r.profile?.conditions || []))].sort(), [allRows]);
  const rows = useMemo(() => {
    const filtered = allRows.filter(row => row.shortlist &&
      (trialFilter === 'all' || row.trial.nctId === trialFilter) &&
      (conditionFilter === 'all' || row.profile?.conditions?.includes(conditionFilter)) &&
      (categoryFilter === 'all' || row.result.outcome === categoryFilter) &&
      (missingFilter === 'all' || (missingFilter === 'yes' ? row.result.counts?.UNKNOWN > 0 : row.result.counts?.UNKNOWN === 0)) &&
      (!query || `${row.result.profile_id} ${profileName(row.profile)}`.toLowerCase().includes(query.toLowerCase())));
    const priority = { 'Potential Match': 0, 'Needs More Information': 1, 'Criteria Conflict': 2 };
    return filtered.sort((a, b) => sort === 'id' ? a.result.profile_id.localeCompare(b.result.profile_id) :
      sort === 'unknown' ? b.result.counts.UNKNOWN - a.result.counts.UNKNOWN :
      priority[a.result.outcome] - priority[b.result.outcome] || a.result.counts.UNKNOWN - b.result.counts.UNKNOWN || b.result.counts.MET - a.result.counts.MET);
  }, [allRows, trialFilter, conditionFilter, categoryFilter, missingFilter, query, sort]);
  const selected = rows.find(r => r.key === selectedKey) || rows[0] || null;
  const activeRows = trialFilter === 'all' ? allRows.filter(row => row.shortlist) : allRows.filter(r => r.shortlist && r.trial.nctId === trialFilter);
  const conflicts = activeRows.filter(r => r.result.criteria.some(c => c.section === 'exclusion' && c.status === 'NOT MET')).length;
  const missingCandidates = activeRows.filter(r => r.result.counts?.UNKNOWN > 0).length;
  const stageCounts = Object.fromEntries(WORKFLOW.map(stage => [stage, activeRows.filter(r => r.stage === stage).length]));
  const barrierCounts = activeRows.flatMap(r => r.result.criteria.filter(c => c.status === 'UNKNOWN').map(c => c.criterion))
    .reduce((acc, criterion) => ({ ...acc, [criterion]: (acc[criterion] || 0) + 1 }), {});
  const topBarriers = Object.entries(barrierCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const selectedTrial = studies.find(t => t.nctId === (trialFilter === 'all' ? selected?.trial.nctId : trialFilter));

  function updateStage(row, stage) {
    const entry = { action: `Stage updated to ${stage}`, at: new Date().toISOString(), actor: 'Researcher demo workspace' };
    setWorkflow(old => { const prior = old[row.key] || { events: [] }; return { ...old, [row.key]: { stage, events: [...prior.events, entry] } }; });
  }
  function resetWorkflow() {
    localStorage.removeItem(STORAGE_KEY);
    setWorkflow({});
  }

  if (loading) return <div className="portal"><Sidebar role="researcher"/><main className="portal-main"><div className="researcher-loading" role="status">Loading official study records and evaluating fictional profiles…</div></main></div>;
  if (error) return <div className="portal"><Sidebar role="researcher"/><main className="portal-main"><div className="page-head"><div><span className="eyebrow">Recruitment workflow</span><h1>Potential Matches</h1></div></div><div className="researcher-error" role="alert"><b>Potential Matches could not be loaded.</b><p>{error}</p><button className="btn" onClick={load}>Retry</button></div></main></div>;

  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main researcher-dashboard">
    <div className="page-head"><div><span className="eyebrow">Recruitment workflow · step 3 of 3</span><h1>Potential Matches</h1><p>A consolidated shortlist from AI Fit Review. These are preliminary records for clinical screening, not enrollment decisions.</p></div><div className="researcher-header-actions"><button className="btn" onClick={() => location.assign('/researcher/ai-fit-review')}>AI Fit Review</button><button className="btn secondary" onClick={() => location.assign('/researcher/trials')}>Clinical Trials</button><button className="btn secondary" onClick={resetWorkflow}>Reset demo workflow</button></div></div>
    <div className="notice"><span><b>Synthetic demo workspace.</b> This table only contains fictional participants added from AI Fit Review. “Available” means ready for demo outreach review, not medically eligible. Clinical screening is always required.</span></div>
    <section className="researcher-study-overview">
      <div className="researcher-study-picker"><label>Study<select aria-label="Trial filter" value={trialFilter} onChange={e => { setTrialFilter(e.target.value); setSelectedKey(''); }}><option value="all">All three official studies</option>{studies.map(t => <option key={t.nctId} value={t.nctId}>{t.nctId} · {t.title}</option>)}</select></label>
      {selectedTrial && <><span className="researcher-study-status">{selectedTrial.status.replaceAll('_', ' ')}</span><h2>{selectedTrial.title}</h2><p><b>{selectedTrial.nctId}</b> · {selectedTrial.source} · {selectedTrial.retrievedAt} · {selectedTrial.conditions.join(', ') || 'Condition not provided'}</p><p>{selectedTrial.summary}</p><a href={selectedTrial.studyUrl} target="_blank" rel="noreferrer">Open official ClinicalTrials.gov record ↗</a><details><summary>Eligibility criteria from the source</summary><pre>{selectedTrial.eligibility || 'Eligibility text not provided in the source.'}</pre></details></>}
      </div>
      <div className="researcher-summary-metrics"><article><span>Patient–study pairs ranked</span><b>{activeRows.length}</b><small>Derived from current study results</small></article><article><span>Known exclusion conflicts</span><b>{conflicts}</b><small>Candidate rows with NOT MET exclusion criteria</small></article><article><span>Missing-data barriers</span><b>{missingCandidates}</b><small>Candidates with one or more UNKNOWN criteria</small></article></div>
    </section>
    {showCompare && <section className="researcher-compare"><div><span className="eyebrow">Official record comparison</span><h2>Eligibility criteria by study</h2><p>Original criteria text is shown as retrieved. Differences are not normalized into clinical equivalence.</p></div><div className="researcher-compare-grid">{studies.map(t => <article key={t.nctId}><h3>{t.title}</h3><b>{t.nctId} · {t.status.replaceAll('_', ' ')}</b><p>{t.conditions.join(', ')}</p><details open><summary>View source eligibility criteria</summary><pre>{t.eligibility || 'Not provided'}</pre></details><a href={t.studyUrl} target="_blank" rel="noreferrer">Source record ↗</a></article>)}</div></section>}
    <section className="researcher-analytics-grid"><article className="researcher-chart"><h2>Recruitment pipeline</h2><p>Candidate counts for {selectedTrial?.nctId || 'all loaded trials'} · all data synthetic</p>{WORKFLOW.map(stage => <div className="pipeline-row" key={stage}><span>{stage}</span><div><i style={{ width: `${activeRows.length ? Math.max(stageCounts[stage] / activeRows.length * 100, stageCounts[stage] ? 4 : 0) : 0}%` }}/></div><b>{stageCounts[stage]}</b></div>)}</article><article className="researcher-chart"><h2>Missing-data barriers</h2><p>UNKNOWN criterion occurrences from current rule-engine results</p>{topBarriers.length ? topBarriers.map(([barrier, count]) => <div className="pipeline-row" key={barrier}><span title={barrier}>{barrier}</span><div><i style={{ width: `${Math.max(count / Math.max(...topBarriers.map(x => x[1])) * 100, 4)}%` }}/></div><b>{count}</b></div>) : <p className="researcher-empty">No unknown criteria in this result set.</p>}<p className="researcher-conflict-note">Known exclusion conflicts: <b>{conflicts}</b> · Candidates with missing information: <b>{missingCandidates}</b></p></article></section>
    <section className="researcher-candidate-area"><div className="researcher-candidate-heading"><div><span className="eyebrow">Consolidated shortlist</span><h2>Reviewed potential matches</h2><p>Names and identifiers are fictional. Expand a row for the detailed source-grounded evidence.</p></div><label>Search participant<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Maya Patel or SYN-002"/></label></div>
      <div className="researcher-filters"><label>Condition<select value={conditionFilter} onChange={e => setConditionFilter(e.target.value)}><option value="all">All conditions</option>{conditions.map(c => <option key={c}>{c}</option>)}</select></label><label>Match category<select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">All categories</option><option>Potential Match</option><option>Needs More Information</option><option>Criteria Conflict</option></select></label><label>Missing information<select value={missingFilter} onChange={e => setMissingFilter(e.target.value)}><option value="all">Any</option><option value="yes">Has UNKNOWN criteria</option><option value="no">No UNKNOWN criteria</option></select></label><label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}><option value="priority">Review priority</option><option value="unknown">Most unknown criteria</option><option value="id">Patient ID</option></select></label></div>
      <div className="researcher-review-layout"><div className="researcher-table-wrap"><table><thead><tr><th>Participant</th><th>Study</th><th>Availability</th><th>Preliminary review</th><th>Requirements</th><th>Priority</th><th/></tr></thead><tbody>{rows.map(row => <tr key={row.key} className={selected?.key === row.key ? 'selected-row' : ''} onClick={() => setSelectedKey(row.key)} tabIndex="0" onKeyDown={e => e.key === 'Enter' && setSelectedKey(row.key)}><td><button className="researcher-patient-link">{profileName(row.profile)}</button><small>{row.result.profile_id} · fictional synthetic participant</small></td><td>{row.trial.nctId}<small>{row.trial.title}</small></td><td>{row.availability}</td><td><span className={`researcher-category ${row.result.outcome === 'Potential Match' ? 'good' : row.result.outcome === 'Criteria Conflict' ? 'conflict' : 'review'}`}>{row.result.outcome}</span></td><td>Met {row.result.counts.MET} · Not met {row.result.counts['NOT MET']} · Review {row.result.counts.UNKNOWN}</td><td>#{row.result.rank} · {row.stage}</td><td><button className="link-btn" onClick={event => { event.stopPropagation(); saveAiSelection({studyId:row.trial.nctId,profileId:row.profile.profile_id}); location.assign('/researcher/ai-fit-review'); }}>Open AI review →</button></td></tr>)}</tbody></table>{!rows.length && <div className="researcher-empty">No reviewed participants are in Potential Matches yet. Start in Clinical Trials, run AI Fit Review for an available fictional participant, then add that review here.</div>}</div>
        {selected && <aside className="researcher-review-panel"><div className="review-panel-head"><div><span className="eyebrow">{selected.trial.nctId} · fictional synthetic participant</span><h2>{profileName(selected.profile)}</h2></div><span className={`researcher-category ${selected.result.outcome === 'Potential Match' ? 'good' : selected.result.outcome === 'Criteria Conflict' ? 'conflict' : 'review'}`}>{selected.result.outcome}</span></div><p><b>Profile ID:</b> {selected.result.profile_id}</p><p><b>Availability:</b> {selected.availability}</p><p><b>Conditions:</b> {selected.profile?.conditions?.join(', ') || 'Not documented'}</p><p><b>Workflow state:</b> {selected.stage}</p><p><b>Requirements:</b> Met {selected.result.counts.MET} · Not met {selected.result.counts['NOT MET']} · Needs review {selected.result.counts.UNKNOWN}</p><p className="review-disclaimer">Prioritization heuristic only; not a probability or enrollment eligibility decision.</p><div className="review-actions"><label>Update recruitment stage<select aria-label="Update recruitment stage" value={selected.stage} onChange={e => updateStage(selected, e.target.value)}>{WORKFLOW.map(s => <option key={s}>{s}</option>)}</select></label><button className="btn secondary" onClick={() => { saveAiSelection({studyId:selected.trial.nctId,profileId:selected.profile.profile_id}); location.assign('/researcher/ai-fit-review'); }}>Open detailed AI review</button><small>“Available” only means the fictional profile is available for demo outreach review. Human clinical screening is still required.</small></div>
          <h3>Criterion-by-criterion evidence</h3><div className="researcher-criteria-audit">{selected.result.criteria.map(c => <article key={c.criterion_id}><div><b>{c.status}</b><small>{c.section} · {c.logic}</small></div><h4>{c.criterion}</h4><p><b>Source:</b> {c.original_text}</p><p><b>Evidence:</b> {c.profile_evidence}</p><p><b>Reason:</b> {c.explanation}</p>{c.missing_information?.length > 0 && <small>Review needed: {c.missing_information.join('; ')}</small>}</article>)}</div>
          {selected.events.length > 0 && <div className="researcher-action-log"><h3>Researcher action history</h3>{selected.events.map((event, i) => <p key={`${event.at}-${i}`}><b>{event.action}</b> · {new Date(event.at).toLocaleString()} · {event.actor}</p>)}</div>}
        </aside>}
      </div>
    </section>
  </main></div>;
}
