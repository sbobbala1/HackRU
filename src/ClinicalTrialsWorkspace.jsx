import React, { useEffect, useMemo, useState } from 'react';
import { getClinicalTrial } from './services/clinicalTrials';
import { patients } from './ExplainableMatchDemo';
import { availabilityFor, profileName, saveAiSelection } from './recruitmentWorkflow';
import WorkplaceBadge from './WorkplaceBadge';
import './clinical-trials-workspace.css';

const STUDY_IDS = ['NCT05564039', 'NCT05025787', 'NCT04791371'];
const normalize = value => String(value || '').toLowerCase();

export default function ClinicalTrialsWorkspace({ Sidebar }) {
  const [studies, setStudies] = useState([]);
  const [studyId, setStudyId] = useState(STUDY_IDS[0]);
  const [availability, setAvailability] = useState('all');
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    Promise.all(STUDY_IDS.map(getClinicalTrial)).then(rows => { if (alive) setStudies(rows); }).catch(reason => { if (alive) setError(reason.message); });
    return () => { alive = false; };
  }, []);
  const study = studies.find(row => row.nctId === studyId);
  const roster = useMemo(() => {
    const topic = normalize(study?.conditions?.[0]);
    return patients.filter(profile => !topic || (profile.conditions || []).some(condition => normalize(condition).includes(topic) || topic.includes(normalize(condition))))
      .filter(profile => availability === 'all' || availabilityFor(profile) === availability);
  }, [study, availability]);
  function openReview(profile) {
    saveAiSelection({ studyId, profileId: profile.profile_id });
    location.assign('/researcher/ai-fit-review');
  }
  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main clinical-trials-workspace">
    <div className="page-head"><div><span className="eyebrow">Recruitment workflow · step 1 of 4</span><h1>Clinical Trials</h1><p>Choose a public study record and begin with fictional participants who are available for demo outreach.</p></div><WorkplaceBadge/></div>
    <div className="notice"><span><b>Availability is not eligibility.</b> “Available” means a fictional, consented demo profile can be reviewed for outreach. A study team must perform clinical screening before any enrollment decision.</span></div>
    {error && <div className="form-error">Unable to load public study records: {error}</div>}
    <section className="clinical-trial-controls"><label>Public study<select value={studyId} onChange={event => setStudyId(event.target.value)}>{STUDY_IDS.map(id => <option key={id} value={id}>{id}{studies.find(row => row.nctId === id) ? ` · ${studies.find(row => row.nctId === id).title}` : ''}</option>)}</select></label><label>Availability<select value={availability} onChange={event => setAvailability(event.target.value)}><option value="all">All fictional profiles</option><option>Available</option><option>Pending confirmation</option><option>Not available</option></select></label></section>
    {!study && !error && <div className="empty">Loading ClinicalTrials.gov study details…</div>}
    {study && <><section className="clinical-trial-summary"><div><span className="eyebrow">{study.nctId} · {study.status}</span><h2>{study.title}</h2><p>{study.summary}</p><small>Source: {study.source} · retrieved {new Date(study.retrievedAt).toLocaleString()}</small></div><a href={study.studyUrl} target="_blank" rel="noreferrer">Open official record ↗</a></section>
      <section className="clinical-roster"><div className="section-row"><div><span className="eyebrow">Recruitment roster</span><h2>Available fictional participants</h2><p>Every person below is synthetic, not a real patient or hospital record.</p></div><span className="clinical-roster-count">{roster.filter(profile => availabilityFor(profile) === 'Available').length} available</span></div><div className="table-wrap"><table><thead><tr><th>Participant</th><th>Availability</th><th>Recruitment stage</th><th>Consent</th><th>Site / location</th><th>Last reviewed</th><th/></tr></thead><tbody>{roster.map(profile => { const status = availabilityFor(profile); return <tr key={profile.profile_id}><td><b>{profileName(profile)}</b><small>{profile.profile_id} · Fictional synthetic participant</small></td><td><span className={`availability availability-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span></td><td>{status === 'Available' ? 'Ready for AI review' : status === 'Pending confirmation' ? 'Not reviewed' : 'Not proceeding'}</td><td>{profile.demo_consent ? 'Synthetic demo opt-in' : 'No demo consent'}</td><td>{study.locations?.[0] || 'Not provided by source'}</td><td>{profile.last_reviewed || 'Not yet reviewed'}</td><td><button className="link-btn" disabled={status !== 'Available'} onClick={() => openReview(profile)}>{status === 'Available' ? 'Review fit →' : 'Unavailable'}</button></td></tr>; })}</tbody></table></div>{!roster.length && <div className="empty">No fictional profiles match this study and availability filter.</div>}</section></>}
  </main></div>;
}
