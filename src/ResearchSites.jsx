import React, { useEffect, useMemo, useState } from 'react';
import { getClinicalTrial } from './services/clinicalTrials';
import WorkplaceBadge from './WorkplaceBadge';
import { publicSitesFromStudies, readWorkplace, saveWorkplace } from './researcherWorkspace';
import { startRecruitmentCycleContext } from './recruitmentWorkflow';
import './research-sites.css';

const STUDY_IDS = ['NCT05564039', 'NCT05025787', 'NCT04791371'];
const COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'All public study locations'];
const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const siteKey = site => [site.facility, site.city, site.stateOrRegion, site.country, site.postalCode].join('|');

export default function ResearchSites({ Sidebar }) {
  const [studies, setStudies] = useState([]); const [workplace, setWorkplace] = useState(readWorkplace); const [activeStudyId, setActiveStudyId] = useState(''); const [error, setError] = useState(''); const [saved, setSaved] = useState('');
  useEffect(() => { let active = true; Promise.all(STUDY_IDS.map(getClinicalTrial)).then(rows => { if (active) { setStudies(rows); setError(''); } }).catch(reason => active && setError(`Unable to load public study sites: ${reason.message}`)); return () => { active = false; }; }, []);
  const sites = useMemo(() => publicSitesFromStudies(studies), [studies]);
  const regions = useMemo(() => unique(sites.filter(site => !workplace.country || workplace.country === 'All public study locations' || site.country === workplace.country).map(site => site.stateOrRegion)), [sites, workplace.country]);
  const cities = useMemo(() => unique(sites.filter(site => (!workplace.country || workplace.country === 'All public study locations' || site.country === workplace.country) && (!workplace.stateOrRegion || site.stateOrRegion === workplace.stateOrRegion)).map(site => site.city)), [sites, workplace.country, workplace.stateOrRegion]);
  const facilities = useMemo(() => sites.filter(site => (!workplace.country || workplace.country === 'All public study locations' || site.country === workplace.country) && (!workplace.stateOrRegion || site.stateOrRegion === workplace.stateOrRegion) && (!workplace.city || site.city === workplace.city)), [sites, workplace.country, workplace.stateOrRegion, workplace.city]);
  const update = patch => { const next = { ...workplace, ...patch }; setWorkplace(next); };
  const persist = () => {
    const next = saveWorkplace({ ...workplace, country: workplace.country === 'All public study locations' ? '' : workplace.country });
    setWorkplace(next);
    const study = studies.find(item => item.nctId === activeStudyId);
    if (!next.publicLocationText && !next.publicFacilityName) return setSaved('Choose a public hospital, clinic, or location context before starting Screening.');
    if (!study) return setSaved('Choose an active public study before starting Screening.');
    startRecruitmentCycleContext({ workplace: next, study });
    setSaved(`Active recruitment cycle started for ${study.nctId}. Screening is ready.`);
  };
  const selectedSite = facilities.find(site => siteKey(site) === workplace._siteKey);

  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main research-sites-page">
    <div className="page-head"><div><span className="eyebrow">Researcher workspace · public study-location context</span><h1>Data & sites</h1><p>Set a public ClinicalTrials.gov location context for this demo. This does not verify researcher affiliation, employment, or access to hospital records.</p></div><WorkplaceBadge/></div>
    <div className="notice"><span><b>Public-source context only:</b> Workplace context is selected from public ClinicalTrials.gov study-location information for this demo. It does not verify researcher affiliation, employment, or access to hospital records.</span></div>
    {error && <div className="form-error">{error}</div>}
    <section className="workplace-selector"><div><span className="eyebrow">Guided workplace selector</span><h2>Choose a precise public site context</h2><p>Facility names, cities, and regions appear only when listed in the loaded public study records.</p></div><div className="workplace-steps">
      <label><span>1. Country</span><select value={workplace.country || 'All public study locations'} onChange={event => update({ country: event.target.value, stateOrRegion: '', city: '', publicFacilityName: '', publicLocationText: '', _siteKey: '' })}>{COUNTRIES.map(country => <option key={country}>{country}</option>)}</select></label>
      <label><span>2. State / region</span><select value={workplace.stateOrRegion} disabled={!regions.length} onChange={event => update({ stateOrRegion: event.target.value, city: '', publicFacilityName: '', publicLocationText: '', _siteKey: '' })}><option value="">{regions.length ? 'Choose a public state / region' : 'No public regions in loaded records'}</option>{regions.map(region => <option key={region}>{region}</option>)}</select></label>
      <label><span>3. City</span><select value={workplace.city} disabled={!cities.length} onChange={event => update({ city: event.target.value, publicFacilityName: '', publicLocationText: '', _siteKey: '' })}><option value="">{cities.length ? 'Choose a public city' : 'Choose a region first'}</option>{cities.map(city => <option key={city}>{city}</option>)}</select></label>
      <label><span>4. Public hospital or clinic</span><select value={workplace._siteKey || ''} disabled={!facilities.length} onChange={event => { const chosen = facilities.find(site => siteKey(site) === event.target.value); update({ _siteKey: event.target.value, publicFacilityName: chosen?.facility || '', publicLocationText: chosen?.publicLocationText || '' }); }}><option value="">{facilities.length ? 'Choose a public facility / location' : 'No public sites match this context'}</option>{facilities.map(site => <option key={siteKey(site)} value={siteKey(site)}>{site.facility || 'Facility name not provided in the public source'} · {site.city || site.stateOrRegion || site.country}</option>)}</select></label>
      <label><span>5. Active public study</span><select value={activeStudyId} onChange={event => setActiveStudyId(event.target.value)} disabled={!studies.length}><option value="">Choose a public study for this cycle</option>{studies.map(study => <option key={study.nctId} value={study.nctId}>{study.nctId} · {study.title}</option>)}</select></label>
    </div><div className="workplace-save"><div><b>{selectedSite?.facility || (workplace.city ? 'Public city/region context selected' : 'No public site selected')}</b><small>{workplace.publicLocationText || [workplace.city, workplace.stateOrRegion, workplace.country].filter(Boolean).join(', ') || 'Choose a location from public source data.'}</small></div><button className="btn" onClick={persist}>Save workplace context</button></div></section>
    {saved && <div className={saved.includes('started') ? 'success' : 'form-error'}>{saved}</div>}
    {studies.length && !facilities.length && workplace.country && <section className="empty site-empty"><b>No loaded public ClinicalTrials.gov study sites match this exact workplace context.</b><p>You can broaden to city, state / region, country, or all public locations.</p><div><button className="btn secondary" onClick={() => update({ publicFacilityName: '', publicLocationText: '', _siteKey: '' })}>Broaden to city</button><button className="btn secondary" onClick={() => update({ city: '', publicFacilityName: '', publicLocationText: '', _siteKey: '' })}>Broaden to state / region</button><button className="btn secondary" onClick={() => update({ stateOrRegion: '', city: '', publicFacilityName: '', publicLocationText: '', _siteKey: '' })}>Broaden to country</button><button className="btn secondary" onClick={() => update({ country: 'All public study locations', stateOrRegion: '', city: '', publicFacilityName: '', publicLocationText: '', _siteKey: '' })}>Show all public locations</button></div></section>}
    <section className="public-site-results"><span className="eyebrow">Loaded public study locations</span><h2>{facilities.length} matching public site{facilities.length === 1 ? '' : 's'}</h2>{facilities.map(site => <article key={siteKey(site)}><b>{site.facility || 'Facility name not provided in the public source'}</b><span>{[site.city, site.stateOrRegion, site.country, site.postalCode].filter(Boolean).join(' · ') || 'Partial location data only'}</span><small>{site.publicLocationText}</small></article>)}</section>
  </main></div>;
}
