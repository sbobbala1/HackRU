export const AI_SELECTION_KEY = 'vitra-ai-fit-selection-v1';
export const SHORTLIST_KEY = 'vitra-potential-matches-v1';
export const SCREENING_QUEUE_KEY = 'vitra-screening-queue-v1';
export const AI_REVIEW_QUEUE_KEY = 'vitra-ai-review-queue-v1';
export const AI_REVIEW_EVENT = 'vitra-ai-review-change';

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

export function readScreeningQueue() {
  return readJson(SCREENING_QUEUE_KEY, {});
}

export function screeningSourceStatus(trialId, profile) {
  if (!profile?.demo_consent || availabilityFor(profile) !== 'Available') return 'Not advancing';
  const cleared = new Set(['SYN-001', 'SYN-007', 'SYN-013', 'SYN-014', 'SYN-016']);
  if (cleared.has(profile.profile_id)) return 'Screening workflow cleared';
  if (profile.profile_id === 'SYN-009') return 'Needs study-team follow-up';
  return 'Not reviewed';
}

export function readAiReviewQueue() { return readJson(AI_REVIEW_QUEUE_KEY, {}); }
export function setAiReviewReady({ trialId, profileId, ready }) {
  const key = shortlistKey(trialId, profileId); const queue = readAiReviewQueue();
  if (ready) queue[key] = { trialId, profileId, readyAt: new Date().toISOString(), status: 'Ready for AI Fit Review' };
  else delete queue[key];
  localStorage.setItem(AI_REVIEW_QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event(AI_REVIEW_EVENT));
  return queue;
}

export function shortlistKey(trialId, profileId) {
  return `${trialId}:${profileId}`;
}

export function resetActiveRecruitmentWorkflow() {
  localStorage.removeItem(AI_SELECTION_KEY);
  localStorage.removeItem(AI_REVIEW_QUEUE_KEY);
  localStorage.removeItem(SHORTLIST_KEY);
  localStorage.removeItem(SCREENING_QUEUE_KEY);
  window.dispatchEvent(new Event(AI_REVIEW_EVENT));
}
