import React, { useEffect, useMemo, useState } from 'react';
import { getClinicalTrial } from './services/clinicalTrials';
import { api } from './services/api';
import { criteriaText } from './services/demoMode';
import { patients } from './ExplainableMatchDemo';
import WorkplaceBadge from './WorkplaceBadge';
import { RECRUITMENT_CYCLE_EVENT, availabilityFor, profileName, readActiveRecruitmentContext, saveAiSelection } from './recruitmentWorkflow';
import { finalistEvent, readFinalistSelections } from './finalistSelections';
import './potential-matches.css';


export default function PotentialMatches({ Sidebar }) {
  const [loaded, setLoaded] = useState([]);
  const [finalists, setFinalists] = useState(readFinalistSelections);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState('');
  const [cycleContext, setCycleContext] = useState(readActiveRecruitmentContext);

  useEffect(() => {
    const id = cycleContext?.study?.nctId;
    if (!id) { setLoaded([]); return undefined; }
    let live = true;
    getClinicalTrial(id).then(async study => {
      const results = await api.rankEligibility(study.nctId, study.studyUrl, criteriaText(study), patients);
      if (live) setLoaded(results.map(result => ({ study, result, profile: patients.find(profile => profile.profile_id === result.profile_id) })));
    }).catch(reason => live && setError(reason.message));
    return () => { live = false; };
  }, [cycleContext?.study?.nctId]);
  useEffect(() => { const sync = () => setCycleContext(readActiveRecruitmentContext()); window.addEventListener(RECRUITMENT_CYCLE_EVENT, sync); return () => window.removeEventListener(RECRUITMENT_CYCLE_EVENT, sync); }, []);
  useEffect(() => {
    const sync = () => setFinalists(readFinalistSelections());
    window.addEventListener(finalistEvent, sync);
    return () => window.removeEventListener(finalistEvent, sync);
  }, []);

  const rows = useMemo(() => loaded.map(row => ({ ...row, finalist: Object.values(finalists).find(item => item.profileId === row.result.profile_id && item.trialId === row.study.nctId) })).filter(row => row.finalist), [loaded, finalists]);
  if (!cycleContext) return <div className="portal"><Sidebar role="researcher"/><main className="portal-main potential-matches-page"><div className="page-head"><div><span className="eyebrow">Recruitment workflow</span><h1>Final Matches</h1></div><WorkplaceBadge/></div><section className="empty"><h2>No Final Matches in the active cycle</h2><p>Choose a site and study in Data & Sites, then progress records through Screening and AI Fit Review.</p><button className="btn" onClick={() => location.assign('/researcher/sites')}>Open Data & Sites</button></section></main></div>;
  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main potential-matches-page">
    <div className="page-head"><div><span className="eyebrow">Recruitment workflow · Screening → AI Fit Review → Final Matches</span><h1>Final Matches</h1></div><div className="final-header"><WorkplaceBadge/><button className="btn" disabled={!rows.length} onClick={() => location.assign('/researcher/outreach')}>Open Outreach Center ({rows.length})</button></div></div>
    {error && <div className="form-error">{error}</div>}
    <section className="match-metric-grid">{[[rows.length, 'Assigned Final Matches'], [rows.reduce((count, row) => count + row.result.counts.MET, 0), 'Requirements met'], [rows.reduce((count, row) => count + row.result.counts['NOT MET'], 0), 'Requirements not met'], [rows.reduce((count, row) => count + row.result.counts.UNKNOWN, 0), 'Unknown requirements']].map(([value, label]) => <article key={label}><b>{value}</b><span>{label}</span></article>)}</section>
    <section className="final-chart-wrap"><table className="final-chart"><thead><tr><th>Participant</th><th>Trial / public site</th><th>Consent & availability</th><th>Deterministic result</th><th>Requirements</th><th>Assigned</th><th>Actions</th></tr></thead><tbody>
      {rows.map(row => <React.Fragment key={`${row.study.nctId}:${row.result.profile_id}`}><tr><td><b>{profileName(row.profile)}</b><small>{row.result.profile_id} · fictional synthetic participant</small></td><td><b>{row.study.nctId}</b><small>{row.study.title}</small><small>{row.finalist.publicSite}</small></td><td><small>Fictional consent recorded</small><b>{availabilityFor(row.profile)}</b></td><td><b>Potential Match</b><small>Deterministic, source-linked evidence</small></td><td>Met {row.result.counts.MET}<br/>Not met {row.result.counts['NOT MET']}<br/>Unknown {row.result.counts.UNKNOWN}</td><td><small>{new Date(row.finalist.selectedAt).toLocaleString()}</small></td><td><button className="link-btn" onClick={() => setExpanded(expanded === row.result.profile_id ? null : row.result.profile_id)}>{expanded === row.result.profile_id ? 'Hide detail' : 'View requirements'}</button><button className="link-btn" onClick={() => { saveAiSelection({ studyId: row.study.nctId, profileId: row.result.profile_id }); location.assign('/researcher/ai-fit-review'); }}>Open AI review</button></td></tr>{expanded === row.result.profile_id && <tr className="final-detail"><td colSpan="7"><h3>Requirement-by-requirement evidence</h3>{row.result.criteria.map(item => <article key={item.criterion_id}><b>{item.status} · {item.criterion}</b><p><b>ClinicalTrials.gov source text:</b> {item.original_text}</p><p><b>Evidence:</b> {item.profile_evidence}</p><small>{item.explanation}</small></article>)}</td></tr>}</React.Fragment>)}
      {!rows.length && <tr><td colSpan="7"><div className="empty">No Final Matches yet. In Screening, mark a cleared record Ready for AI Fit Review; then use Assign to Final Matches in AI Fit Review.</div></td></tr>}
    </tbody></table></section>
  </main></div>;
}
