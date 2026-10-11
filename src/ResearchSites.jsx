import React, { useEffect, useMemo, useState } from 'react';
import { getClinicalTrial } from './services/clinicalTrials';
import { patients } from './ExplainableMatchDemo';
import WorkplaceBadge from './WorkplaceBadge';
import { locationMatchesWorkplace, readWorkplace, saveWorkplace, WORKPLACES } from './researcherWorkspace';
import './research-sites.css';

const STUDY_IDS = ['NCT05564039', 'NCT05025787', 'NCT04791371'];

function normalize(value='') { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

export default function ResearchSites({ Sidebar }) {
  const [studies, setStudies] = useState([]);
  const [studyId, setStudyId] = useState(STUDY_IDS[0]);
  const [site, setSite] = useState('');
  const [workplace, setWorkplace] = useState(readWorkplace);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all(STUDY_IDS.map(getClinicalTrial))
      .then(rows => { if (active) { setStudies(rows); setError(''); } })
      .catch(reason => { if (active) setError(`Unable to load public study sites: ${reason.message}`); });
    return () => { active = false; };
  }, []);

  const visibleStudies = studies.filter(row => (statusFilter === 'all' || row.status === statusFilter) && (typeFilter === 'all' || row.type === typeFilter) && (!keyword || `${row.title} ${row.conditions?.join(' ')}`.toLowerCase().includes(keyword.toLowerCase())));
  const study = visibleStudies.find(row => row.nctId === studyId) || visibleStudies[0];
  const sites = (study?.locations || []).filter(location => locationMatchesWorkplace(location, workplace));
  const selectedSite = site || sites[0] || '';
  const cohort = useMemo(() => {
    const topic = normalize(study?.conditions?.[0] || '');
    return patients.filter(profile => (profile.conditions || []).some(condition => normalize(condition).includes(topic) || topic.includes(normalize(condition))));
  }, [study]);
  const consented = cohort.filter(profile => profile.demo_consent);

  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main research-sites-page">
    <div className="page-head"><div><span className="eyebrow">Researcher workspace · site-aware synthetic cohorts</span><h1>Data & sites</h1><p>Choose your workplace area, then browse public study sites and the fictional demo cohort used for this workflow.</p></div><WorkplaceBadge/></div>
    <div className="notice"><span><b>Synthetic cohort notice:</b> hospital/site names and locations are public study-record data when available. The participant cohort below is fictional and is not hospital patient data.</span></div>
    {error && <div className="form-error">{error}</div>}
    <section className="site-controls">
      <label>Researcher workplace<select value={workplace.id} onChange={event => setWorkplace(saveWorkplace(event.target.value))}>{WORKPLACES.map(place => <option key={place.id} value={place.id}>{place.label}</option>)}</select></label>
      <label>Recruitment status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{[...new Set(studies.map(row => row.status))].map(status => <option key={status}>{status}</option>)}</select></label>
      <label>Study type<select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">All study types</option>{[...new Set(studies.map(row => row.type))].map(type => <option key={type}>{type}</option>)}</select></label>
      <label>Condition or keyword<input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="e.g. diabetes"/></label>
      <label>Study<select value={study?.nctId || ''} onChange={event => { setStudyId(event.target.value); setSite(''); }}>{visibleStudies.map(row => <option key={row.nctId} value={row.nctId}>{row.nctId} · {row.title}</option>)}</select></label>
      {study && <a href={study.studyUrl} target="_blank" rel="noreferrer">Open ClinicalTrials.gov record ↗</a>}
    </section>
    {!study && !error && <div className="empty">Loading public study sites…</div>}
    {study && <><section className="site-study-summary"><div><span className="eyebrow">{study.nctId} · {study.status}</span><h2>{study.title}</h2><p>{study.summary}</p><small>Source: {study.source} · retrieved {new Date(study.retrievedAt).toLocaleString()}</small></div><dl><div><dt>Public sites</dt><dd>{sites.length}</dd></div><div><dt>Fictional cohort</dt><dd>{cohort.length}</dd></div><div><dt>Demo opt-in</dt><dd>{consented.length}</dd></div></dl></section>
      <section className="site-layout"><article className="site-list"><div><span className="eyebrow">Public study locations</span><h2>Select a site</h2><p>Locations are shown only as supplied by the source record.</p></div>{sites.length ? sites.map((location, index) => <button key={`${location}-${index}`} className={selectedSite === location ? 'selected' : ''} onClick={() => setSite(location)}><span><b>{location}</b><small>Public ClinicalTrials.gov study site</small></span><span>→</span></button>) : <div className="empty">This source record does not list locations.</div>}</article>
        <article className="site-cohort"><span className="eyebrow">Selected site</span><h2>{selectedSite || 'No public site selected'}</h2><p>Fictional profiles are assigned for a site-based workflow demonstration; they do not represent patients at this location.</p><div className="site-cohort-metrics"><span><b>{cohort.length}</b> available fictional profiles</span><span><b>{consented.length}</b> explicit demo opt-ins</span></div><div className="site-cohort-list">{cohort.slice(0, 6).map(profile => <div key={profile.profile_id}><span><b>{profile.display_name || profile.profile_id}</b><small>{profile.profile_id} · age {profile.age ?? 'unknown'} · {(profile.conditions || []).join(', ') || 'condition unknown'}</small></span><em>{profile.demo_consent ? 'Demo opt-in' : 'Not shared'}</em></div>)}</div><div className="site-actions"><button className="btn" onClick={() => location.assign('/researcher/recruitment')}>Review potential matches</button><button className="btn secondary" onClick={() => location.assign('/researcher/ai-fit-review')}>Open AI Fit Review</button></div></article>
      </section></>}
  </main></div>;
}
