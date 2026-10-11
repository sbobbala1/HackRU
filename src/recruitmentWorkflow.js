export const AI_SELECTION_KEY = 'vitra-ai-fit-selection-v1';
export const SHORTLIST_KEY = 'vitra-potential-matches-v1';

export function profileName(profile) {
  return profile?.display_name || `Fictional participant ${profile?.profile_id || ''}`.trim();
}

export function availabilityFor(profile) {
  if (!profile?.demo_consent) return 'Not available';
  return profile.availability || 'Available';
}

export function canReview(profile) {
  return availabilityFor(profile) === 'Available' && Boolean(profile?.demo_consent);
}

export function readJson(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key) || ''); return value ?? fallback; }
  catch { return fallback; }
}

export function saveAiSelection(selection) {
  localStorage.setItem(AI_SELECTION_KEY, JSON.stringify(selection));
}

export function readAiSelection() {
  return readJson(AI_SELECTION_KEY, null);
}

export function readShortlist() {
  return readJson(SHORTLIST_KEY, {});
}

export function shortlistKey(trialId, profileId) {
  return `${trialId}:${profileId}`;
}
