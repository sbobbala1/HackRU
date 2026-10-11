import React, { useEffect, useMemo, useState } from 'react';
import { getClinicalTrial } from './services/clinicalTrials';
import { patients } from './ExplainableMatchDemo';
import './research-sites.css';

const STUDY_IDS = ['NCT05564039', 'NCT05025787', 'NCT04791371'];

function normalize(value='') { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

export default function ResearchSites({ Sidebar }) {
  const [studies, setStudies] = useState([]);
  const [studyId, setStudyId] = useState(STUDY_IDS[0]);
  const [site, setSite] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all(STUDY_IDS.map(getClinicalTrial))
      .then(rows => { if (active) { setStudies(rows); setError(''); } })
      .catch(reason => { if (active) setError(`Unable to load public study sites: ${reason.message}`); });
    return () => { active = false; };
  }, []);

  const study = studies.find(row => row.nctId === studyId);
  const sites = study?.locations || [];
  const selectedSite = site || sites[0] || '';
  const cohort = useMemo(() => {
    const topic = normalize(study?.conditions?.[0] || '');
    return patients.filter(profile => (profile.conditions || []).some(condition => normalize(condition).includes(topic) || topic.includes(normalize(condition))));
  }, [study]);
  const consented = cohort.filter(profile => profile.demo_consent);

  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main research-sites-page">
    <div className="page-head"><div><span className="eyebrow">Researcher workspace · site-aware synthetic cohorts</span><h1>Data & sites</h1><p>Choose a public study site, then review the fictional demo cohort assigned to this workflow.</p></div></div>
    <div className="notice"><span><b>Synthetic cohort notice:</b> hospital/site names and locations are public study-record data when available. The participant cohort below is fictional and is not hospital patient data.</span></div>
    {error && <div className="form-error">{error}</div>}
    <section className="site-controls">
      <label>Study<select value={studyId} onChange={event => { setStudyId(event.target.value); setSite(''); }}>{STUDY_IDS.map(id => <option key={id} value={id}>{id}{studies.find(row => row.nctId === id) ? ` · ${studies.find(row => row.nctId === id).title}` : ''}</option>)}</select></label>
      {study && <a href={study.studyUrl} target="_blank" rel="noreferrer">Open ClinicalTrials.gov record ↗</a>}
    </section>
    {!study && !error && <div className="empty">Loading public study sites…</div>}
    {study && <><section className="site-study-summary"><div><span className="eyebrow">{study.nctId} · {study.status}</span><h2>{study.title}</h2><p>{study.summary}</p><small>Source: {study.source} · retrieved {new Date(study.retrievedAt).toLocaleString()}</small></div><dl><div><dt>Public sites</dt><dd>{sites.length}</dd></div><div><dt>Fictional cohort</dt><dd>{cohort.length}</dd></div><div><dt>Demo opt-in</dt><dd>{consented.length}</dd></div></dl></section>
      <section className="site-layout"><article className="site-list"><div><span className="eyebrow">Public study locations</span><h2>Select a site</h2><p>Locations are shown only as supplied by the source record.</p></div>{sites.length ? sites.map((location, index) => <button key={`${location}-${index}`} className={selectedSite === location ? 'selected' : ''} onClick={() => setSite(location)}><span><b>{location}</b><small>Public ClinicalTrials.gov study site</small></span><span>→</span></button>) : <div className="empty">This source record does not list locations.</div>}</article>
        <article className="site-cohort"><span className="eyebrow">Selected site</span><h2>{selectedSite || 'No public site selected'}</h2><p>Fictional profiles are assigned for a site-based workflow demonstration; they do not represent patients at this location.</p><div className="site-cohort-metrics"><span><b>{cohort.length}</b> available fictional profiles</span><span><b>{consented.length}</b> explicit demo opt-ins</span></div><div className="site-cohort-list">{cohort.slice(0, 6).map(profile => <div key={profile.profile_id}><span><b>{profile.display_name || profile.profile_id}</b><small>{profile.profile_id} · age {profile.age ?? 'unknown'} · {(profile.conditions || []).join(', ') || 'condition unknown'}</small></span><em>{profile.demo_consent ? 'Demo opt-in' : 'Not shared'}</em></div>)}</div><div className="site-actions"><button className="btn" onClick={() => location.assign('/researcher/recruitment')}>Review potential matches</button><button className="btn secondary" onClick={() => location.assign('/researcher/ai-fit-review')}>Open AI Fit Review</button></div></article>
      </section></>}
  </main></div>;
}
