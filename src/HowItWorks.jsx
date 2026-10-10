import React, { useState } from 'react';
import { searchClinicalTrials } from './services/clinicalTrials';
import './how-it-works.css';

const steps = [
  ['Explore', 'Search public study records by condition and location. Start with the original source details.'],
  ['Understand', 'Review study activities and eligibility criteria. Missing or unclear information stays visible.'],
  ['Choose', 'Save a study or express interest when you are ready. Sharing is voluntary and consent-aware.'],
  ['Screen with the study team', 'Researchers answer questions and confirm eligibility. Vitra never makes enrollment decisions.'],
];

const featuredCities = [
  { city: 'Newark', state: 'NJ', description: 'Explore public recruiting listings with sites in Newark and nearby communities.', image: 'https://www.trade.gov/sites/default/files/2019-12/Newark%20NJ%20Resized.png' },
  { city: 'New York', state: 'NY', description: 'Browse studies listing research locations across New York City.', image: 'https://images.unsplash.com/photo-1655923478764-dc557f11c497?auto=format&fit=crop&w=1200&q=82' },
  { city: 'Philadelphia', state: 'PA', description: 'See public studies that list Philadelphia area research locations.', image: 'https://images.unsplash.com/photo-1581909811589-a1317515f20c?auto=format&fit=crop&w=1200&q=82' },
  { city: 'Boston', state: 'MA', description: 'Search recruiting records that include sites in the Boston area.', image: 'https://images.unsplash.com/photo-1599606593256-0570b9134414?auto=format&fit=crop&w=1200&q=82' },
  { city: 'Chicago', state: 'IL', description: 'Explore public listings with research sites in and around Chicago.', image: 'https://images.unsplash.com/photo-1578066538088-ac2d61dda721?auto=format&fit=crop&w=1200&q=82' },
  { city: 'Los Angeles', state: 'CA', description: 'Browse recruiting study records with locations around Los Angeles.', image: 'https://images.unsplash.com/photo-1637735603473-26f62c86572a?auto=format&fit=crop&w=1200&q=82' },
];

export default function HowItWorks({ Header, Footer }) {
  const [location, setLocation] = useState('New Brunswick, NJ');
  const [selectedCity, setSelectedCity] = useState('');
  const [nearby, setNearby] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [locationError, setLocationError] = useState('');

  async function searchNearby(event, selectedLocation = location) {
    event?.preventDefault();
    const query = selectedLocation.trim();
    if (!query) return;
    setLocation(query);
    setSelectedCity(featuredCities.some(place => `${place.city}, ${place.state}` === query) ? query : '');
    setSearching(true);
    setSearched(true);
    setLocationError('');
    setNearby([]);
    const city = query.split(',')[0].trim().toLowerCase();
    const stateNames = { nj: 'new jersey', ny: 'new york', pa: 'pennsylvania', ma: 'massachusetts', il: 'illinois', ca: 'california' };
    const state = query.split(',')[1]?.trim().toLowerCase();
    const locality = state ? `${city}, ${stateNames[state] || state}` : city;
    try {
      const response = await searchClinicalTrials({ location: query, status: 'RECRUITING', pageSize: 20 });
      const matches = response.studies.map(study => ({
        study,
        sites: study.locations.filter(site => site.toLowerCase().includes(locality)),
      })).filter(row => row.sites.length);
      setNearby(matches.slice(0, 6));
    } catch (error) {
      setLocationError(error.message || 'Location search is unavailable right now.');
    } finally {
      setSearching(false);
    }
  }

  return <><Header/><main className="how-page">
    <section className="how-hero"><div className="how-hero-copy"><span className="eyebrow">A clearer path into research</span><h1>How Vitra works</h1><p>Explore a study, understand what it involves, and choose your next step with a qualified research team.</p></div><div className="how-hero-photo" role="img" aria-label="A clinician talking with a patient"><a className="how-photo-credit" href="https://www.pexels.com/photo/a-doctor-talking-the-patient-7579831/" target="_blank" rel="noopener noreferrer">Photo: cottonbro studio / Pexels</a></div></section>
    <section className="how-journey" id="journey"><div className="how-section-heading"><span className="eyebrow">From discovery to a conversation</span><h2>Four steps. People guide every decision.</h2><p>Vitra helps organize information; the participant and research team make the decisions.</p></div><div className="journey-track">{steps.map(([title, text], index)=><article className="journey-step" key={title}><span className="journey-number">0{index + 1}</span>{index < steps.length - 1&&<span className="journey-connector" aria-hidden="true"/>}<h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="how-clinical-break"><div className="how-clinical-photo" role="img" aria-label="Two scientists working together in a laboratory"><a className="how-photo-credit" href="https://www.pexels.com/photo/scientists-experimenting-in-the-laboratory-9243720/" target="_blank" rel="noopener noreferrer">Photo: Mikhail Nilov / Pexels</a></div><div><span className="eyebrow">Clear information, human review</span><h2>Study records are a starting point.</h2><p>Vitra displays public ClinicalTrials.gov information and supports review of eligibility criteria. A potential match is never a promise of eligibility. The study team explains the protocol, answers questions, and conducts screening.</p><a className="how-inline-link" href="/clinical-trial-guide">Explore the Clinical trial guide →</a></div></section>
    <section className="research-sites" id="locations">
      <div className="locations-showcase">
        <div className="locations-showcase-intro">
          <span className="eyebrow">Explore by location</span>
          <h2>Locations</h2>
          <p>Browse public study listings by city. Each listing shows the research sites named in the official record.</p>
          <a className="locations-explore-link" href="/locations">Explore all locations <span aria-hidden="true">→</span></a>
        </div>
        <div className="location-photo-grid">{featuredCities.map((place, index) => <button className={`location-photo-card location-photo-card-${index + 1}`} key={place.city} type="button" onClick={event => searchNearby(event, `${place.city}, ${place.state}`)} disabled={searching} aria-label={`Search recruiting study locations near ${place.city}, ${place.state}`}>
          <img src={place.image} alt="" loading="lazy"/>
          <span className="location-photo-shade"/>
          <span className="location-photo-caption"><b>{place.city}, {place.state}</b><small>View nearby studies <span aria-hidden="true">→</span></small></span>
        </button>)}</div>
      </div>
      <p className="how-city-note">These are location search shortcuts, not Vitra-affiliated clinics. Study availability and site details come from public records and can change.</p>
      <form className="site-search" onSubmit={searchNearby}><div className="site-search-field"><label htmlFor="how-location-select">Choose a city</label><select id="how-location-select" value={selectedCity} onChange={event=>{setSelectedCity(event.target.value);if(event.target.value)setLocation(event.target.value)}}><option value="">Select a featured city…</option>{featuredCities.map(place=><option key={place.city} value={`${place.city}, ${place.state}`}>{place.city}, {place.state}</option>)}</select></div><div className="site-search-field"><label htmlFor="how-location-search">Or search any city, state, or ZIP code</label><input id="how-location-search" value={location} onChange={event=>{setLocation(event.target.value);setSelectedCity('')}} placeholder="e.g. Newark, NJ"/></div><button className="btn" disabled={searching}>{searching?'Searching…':'Search nearby studies'}</button></form>
      {searching&&<p className="site-state" role="status">Searching ClinicalTrials.gov for recruiting records…</p>}{locationError&&<div className="site-state site-error" role="alert">{locationError}</div>}{searched&&!searching&&!locationError&&nearby.length===0&&<p className="site-state">No recruiting study sites matched that location. Try a nearby city or ZIP code.</p>}{nearby.length>0&&<div className="site-results" aria-live="polite">{nearby.map(({study,sites})=><article key={study.nctId}><span className="site-status">{study.status} · {study.nctId}</span><h3>{study.title}</h3><p>{study.conditions.join(' · ')||'Condition not listed in source'}</p><ul>{sites.slice(0,3).map(site=><li key={site}>{site}</li>)}</ul><a href={study.studyUrl} target="_blank" rel="noreferrer">View official record ↗</a></article>)}</div>}
    </section>
    <section className="how-last-call"><h2>Ready to explore?</h2><p>Start with a condition or look up a study you already know.</p><a className="btn" href="/patient/trials">Find clinical trials →</a></section>
  </main><Footer/></>;
}
