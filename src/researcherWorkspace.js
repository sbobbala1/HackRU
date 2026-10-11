const KEY = 'vitra-researcher-workplace-v1';
export const WORKPLACES = [
  { id: 'united-states', label: 'United States' },
  { id: 'united-kingdom', label: 'United Kingdom' },
  { id: 'canada', label: 'Canada' },
  { id: 'all', label: 'All public study locations' },
];
const defaultWorkplace = { id: 'united-states', label: 'United States', country: 'United States', stateOrRegion: '', city: '', publicFacilityName: '', publicLocationText: '', selectedAt: '', source: 'ClinicalTrials.gov API v2' };

export function readWorkplace() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '');
    if (!stored) return defaultWorkplace;
    const legacy = WORKPLACES.find(place => place.id === stored.id);
    return { ...defaultWorkplace, ...stored, country: stored.country || legacy?.label || defaultWorkplace.country, label: stored.label || stored.publicFacilityName || stored.city || stored.country || legacy?.label || defaultWorkplace.label };
  } catch { return defaultWorkplace; }
}

export function saveWorkplace(selection) {
  const legacy = WORKPLACES.find(item => item.id === selection) || WORKPLACES.find(item => item.id === selection?.id);
  const next = typeof selection === 'string'
    ? { ...defaultWorkplace, id: legacy?.id || 'all', country: legacy?.id === 'all' ? '' : legacy?.label || '', label: legacy?.label || 'All public study locations', selectedAt: new Date().toISOString() }
    : { ...defaultWorkplace, ...selection, id: legacy?.id || selection.id || 'custom', label: selection.publicFacilityName || selection.city || selection.stateOrRegion || selection.country || 'All public study locations', selectedAt: new Date().toISOString(), source: 'ClinicalTrials.gov API v2' };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('vitra-workplace-change'));
  return next;
}

export function publicSitesFromStudies(studies = []) {
  const sites = studies.flatMap(study => study.locationDetails || []);
  const seen = new Set();
  return sites.filter(site => { const key = [site.facility, site.city, site.stateOrRegion, site.country, site.postalCode].map(value => String(value || '').toLowerCase()).join('|'); if (seen.has(key)) return false; seen.add(key); return true; });
}

export function locationMatchesWorkplace(location, workplace = readWorkplace(), scope = 'exact') {
  if (scope === 'all' || !workplace || workplace.id === 'all' || !workplace.country) return true;
  const item = typeof location === 'string' ? { publicLocationText: location } : location;
  const text = `${item.publicLocationText || ''} ${item.facility || ''} ${item.city || ''} ${item.stateOrRegion || ''} ${item.country || ''}`.toLowerCase();
  const has = value => !value || text.includes(String(value).toLowerCase());
  if (!has(workplace.country)) return false;
  if (scope === 'country') return true;
  if (!has(workplace.stateOrRegion)) return false;
  if (scope === 'state') return true;
  if (!has(workplace.city)) return false;
  if (scope === 'city') return true;
  return !workplace.publicFacilityName || has(workplace.publicFacilityName);
}
