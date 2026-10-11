const KEY = 'vitra-researcher-workplace-v1';
export const WORKPLACES = [
  { id: 'united-states', label: 'United States' },
  { id: 'united-kingdom', label: 'United Kingdom' },
  { id: 'canada', label: 'Canada' },
  { id: 'all', label: 'All public study locations' },
];

export function readWorkplace() {
  try { const stored = JSON.parse(localStorage.getItem(KEY) || ''); return WORKPLACES.some(place => place.id === stored?.id) ? stored : WORKPLACES[0]; }
  catch { return WORKPLACES[0]; }
}

export function saveWorkplace(id) {
  const place = WORKPLACES.find(item => item.id === id) || WORKPLACES[0];
  localStorage.setItem(KEY, JSON.stringify(place));
  window.dispatchEvent(new Event('vitra-workplace-change'));
  return place;
}

export function locationMatchesWorkplace(location, workplace) {
  if (!workplace || workplace.id === 'all') return true;
  const normalized = String(location || '').toLowerCase();
  if (workplace.id === 'united-states') return normalized.includes('united states');
  if (workplace.id === 'united-kingdom') return normalized.includes('united kingdom') || normalized.includes(', uk');
  if (workplace.id === 'canada') return normalized.includes('canada');
  return true;
}
