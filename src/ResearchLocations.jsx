import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { searchClinicalTrials } from './services/clinicalTrials';
import './research-locations.css';

const locations = [
  { city: 'Newark', state: 'NJ', stateName: 'New Jersey', lat: 40.7357, lng: -74.1724 },
  { city: 'New York', state: 'NY', stateName: 'New York', lat: 40.7128, lng: -74.006 },
  { city: 'Philadelphia', state: 'PA', stateName: 'Pennsylvania', lat: 39.9526, lng: -75.1652 },
  { city: 'Boston', state: 'MA', stateName: 'Massachusetts', lat: 42.3601, lng: -71.0589 },
  { city: 'Chicago', state: 'IL', stateName: 'Illinois', lat: 41.8781, lng: -87.6298 },
  { city: 'Los Angeles', state: 'CA', stateName: 'California', lat: 34.0522, lng: -118.2437 },
  { city: 'Washington', state: 'DC', stateName: 'District of Columbia', lat: 38.9072, lng: -77.0369 },
  { city: 'Atlanta', state: 'GA', stateName: 'Georgia', lat: 33.749, lng: -84.388 },
  { city: 'Houston', state: 'TX', stateName: 'Texas', lat: 29.7604, lng: -95.3698 },
  { city: 'Miami', state: 'FL', stateName: 'Florida', lat: 25.7617, lng: -80.1918 },
  { city: 'Seattle', state: 'WA', stateName: 'Washington', lat: 47.6062, lng: -122.3321 },
  { city: 'San Francisco', state: 'CA', stateName: 'California', lat: 37.7749, lng: -122.4194 },
];

function LeafletCityMap({ selected, onSelect }) {
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const onSelectRef = useRef(onSelect);
  const previousCity = useRef(selected.city);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!mapElement.current) return undefined;
    const map = L.map(mapElement.current, { scrollWheelZoom: false, zoomControl: true });
    mapRef.current = map;
    L.tileLayer(import.meta.env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    }).addTo(map);

    markersRef.current = locations.map(location => {
      const marker = L.circleMarker([location.lat, location.lng], {
        radius: location.city === selected.city ? 9 : 7,
        color: '#ffffff',
        weight: 2,
        fillColor: location.city === selected.city ? '#0b657f' : '#46798b',
        fillOpacity: 0.96,
      }).addTo(map);
      marker.bindTooltip(`${location.city}, ${location.state}`);
      marker.on('click', () => onSelectRef.current(location));
      return { location, marker };
    });

    map.fitBounds(L.latLngBounds(locations.map(location => [location.lat, location.lng])), { padding: [42, 42], maxZoom: 4 });
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 100);
    return () => {
      window.clearTimeout(resizeTimer);
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    markersRef.current.forEach(({ location, marker }) => {
      const isSelected = location.city === selected.city;
      marker.setStyle({ radius: isSelected ? 9 : 7, fillColor: isSelected ? '#0b657f' : '#46798b' });
    });
    if (mapRef.current && previousCity.current !== selected.city) {
      mapRef.current.flyTo([selected.lat, selected.lng], 7, { duration: 0.65 });
    }
    previousCity.current = selected.city;
  }, [selected]);

  return <div ref={mapElement} className="leaflet-city-map" aria-label="Interactive map of research locations"/>;
}

export default function ResearchLocations({ Header, Footer }) {
  const [selected, setSelected] = useState(locations[0]);
  const [view, setView] = useState('studies');
  const [studies, setStudies] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [studiesLoading, setStudiesLoading] = useState(false);
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const [studiesError, setStudiesError] = useState('');
  const [clinicsError, setClinicsError] = useState('');

  useEffect(() => {
    let active = true;
    setStudiesLoading(true);
    setStudiesError('');
    searchClinicalTrials({ location: `${selected.city}, ${selected.state}`, status: 'RECRUITING', pageSize: 8 })
      .then(data => {
        if (!active) return;
        const locality = `${selected.city}, ${selected.stateName}`.toLowerCase();
        setStudies(data.studies.filter(study => study.locations.some(site => site.toLowerCase().includes(locality))));
      })
      .catch(problem => { if (active) { setStudies([]); setStudiesError(problem.message || 'Location search is unavailable.'); } })
      .finally(() => { if (active) setStudiesLoading(false); });
    return () => { active = false; };
  }, [selected]);

  useEffect(() => {
    if (view !== 'clinics') return undefined;
    let active = true;
    setClinicsLoading(true);
    setClinicsError('');
    const around = `around:25000,${selected.lat},${selected.lng}`;
    const query = `[out:json][timeout:20];(node["amenity"~"^(clinic|hospital|doctors)$"](${around});way["amenity"~"^(clinic|hospital|doctors)$"](${around});relation["amenity"~"^(clinic|hospital|doctors)$"](${around});node["healthcare"~"^(clinic|hospital|doctor)$"](${around});way["healthcare"~"^(clinic|hospital|doctor)$"](${around});relation["healthcare"~"^(clinic|hospital|doctor)$"](${around}););out center tags;`;
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
      .then(response => { if (!response.ok) throw new Error('The OpenStreetMap clinic search is temporarily unavailable.'); return response.json(); })
      .then(data => {
        if (!active) return;
        const seen = new Set();
        const rows = (data.elements || []).map(place => {
          const lat = place.lat ?? place.center?.lat;
          const lng = place.lon ?? place.center?.lon;
          const name = place.tags?.name || place.tags?.['name:en'];
          if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const key = `${name.toLowerCase()}-${lat.toFixed(4)}-${lng.toFixed(4)}`;
          if (seen.has(key)) return null;
          seen.add(key);
          const kind = place.tags?.healthcare || place.tags?.amenity || 'healthcare facility';
          return { id: `${place.type}-${place.id}`, name, kind: kind.replaceAll('_', ' '), lat, lng, address: [place.tags?.['addr:street'], place.tags?.['addr:city'] || place.tags?.['addr:town'], place.tags?.['addr:state']].filter(Boolean).join(', '), mapUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}` };
        }).filter(Boolean).slice(0, 12);
        setClinics(rows);
      })
      .catch(problem => { if (active) { setClinics([]); setClinicsError(problem.message || 'Nearby clinic search failed.'); } })
      .finally(() => { if (active) setClinicsLoading(false); });
    return () => { active = false; };
  }, [selected, view]);

  const choose = location => setSelected(location);

  return <><Header/><main className="locations-page">
    <section className="locations-hero"><span className="eyebrow">Explore clinical research</span><h1>Find care and studies nearby.</h1><p>Choose a city, then switch between nearby healthcare locations and recruiting study records.</p></section>
    <section className="locations-explorer" aria-labelledby="location-picker-title">
      <div className="location-picker-head"><div><span className="eyebrow">Featured search cities</span><h2 id="location-picker-title">Select a city</h2></div><p>These are search shortcuts, not a list of Vitra partner clinics.</p></div>
      <div className="location-layout">
        <div className="location-map-wrap"><LeafletCityMap selected={selected} onSelect={choose}/><p className="map-caption">Select a marker or use the city toggles. Map tiles © OpenStreetMap contributors.</p><a className="map-report-link" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue</a></div>
        <div className="location-city-list" role="group" aria-label="Choose a research search location">
          {locations.map(location=><button key={location.city} className={`location-city-toggle ${selected.city===location.city?'active':''}`} onClick={()=>choose(location)} aria-pressed={selected.city===location.city}><span className="city-radio"/><span>{location.city}, {location.state}</span><span className="city-arrow" aria-hidden="true">→</span></button>)}
        </div>
      </div>
    </section>
    <section className="location-results" aria-live="polite"><div className="location-results-heading"><div><span className="eyebrow">Explore nearby</span><h2>{view==='studies'?`Studies near ${selected.city}, ${selected.state}`:`Clinics near ${selected.city}, ${selected.state}`}</h2></div><div className="location-result-controls"><div className="location-view-toggle" role="group" aria-label="Choose nearby results">{[['clinics','Clinics'],['studies','Nearby studies']].map(([value,label])=><button key={value} type="button" aria-pressed={view===value} className={view===value?'active':''} onClick={()=>setView(value)}>{label}</button>)}</div>{view==='studies'&&!studiesLoading&&!studiesError&&<span className="result-count">{studies.length} {studies.length===1?'record':'records'} shown</span>}{view==='clinics'&&!clinicsLoading&&!clinicsError&&<span className="result-count">{clinics.length} {clinics.length===1?'place':'places'} shown</span>}</div></div>
      {view==='studies'&&(studiesLoading?<div className="location-message" role="status">Loading official study locations…</div>:studiesError?<div className="location-message location-error" role="alert">{studiesError}</div>:studies.length===0?<div className="location-message">No recruiting records were found for this city. Try another location.</div>:<div className="location-study-grid">{studies.map(study=><article key={study.nctId}><div className="location-study-meta"><span>{study.status}</span><b>{study.nctId}</b></div><h3>{study.title}</h3><p>{study.conditions.join(' · ')||'Condition not listed in source'}</p><ul>{study.locations.filter(site=>site.toLowerCase().includes(`${selected.city}, ${selected.stateName}`.toLowerCase())).slice(0,3).map(site=><li key={site}>{site}</li>)}</ul><a href={study.studyUrl} target="_blank" rel="noreferrer">View official record ↗</a></article>)}</div>)}
      {view==='clinics'&&(clinicsLoading?<div className="location-message" role="status">Searching OpenStreetMap for nearby healthcare locations…</div>:clinicsError?<div className="location-message location-error" role="alert">{clinicsError}</div>:clinics.length===0?<div className="location-message">No named clinics or hospitals were found nearby. Try another city or switch to nearby studies.</div>:<div className="location-study-grid">{clinics.map(place=><article key={place.id}><div className="location-study-meta"><span>{place.kind}</span><b>OpenStreetMap</b></div><h3>{place.name}</h3><p>{place.address||`${selected.city}, ${selected.state}`}</p><a href={place.mapUrl} target="_blank" rel="noreferrer">View on map ↗</a></article>)}</div>)}
    </section>
    <p className="location-disclaimer">Clinic locations are sourced from OpenStreetMap and may be incomplete or out of date. Recruiting study records come from ClinicalTrials.gov; a listing does not guarantee that a site is enrolling or that someone is eligible. Confirm details with the location or study team.</p>
  </main><Footer/></>;
}
