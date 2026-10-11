export const AI_SELECTION_KEY = 'vitra-ai-fit-selection-v1';
export const SHORTLIST_KEY = 'vitra-potential-matches-v1';
export const SCREENING_QUEUE_KEY = 'vitra-screening-queue-v1';
export const AI_REVIEW_QUEUE_KEY = 'vitra-ai-review-queue-v1';
export const AI_REVIEW_EVENT = 'vitra-ai-review-change';
export const RECRUITMENT_CYCLE_KEY = 'vitra-active-recruitment-cycle-v1';
export const RECRUITMENT_CYCLE_EVENT = 'vitra-recruitment-cycle-change';
export const RECRUITMENT_CONTEXT_KEY = 'vitra-active-recruitment-context-v1';

export function readActiveRecruitmentCycle() {
  const current = readJson(RECRUITMENT_CYCLE_KEY, null);
  if (current?.id) return current;
  const created = { id: `CYCLE-${Date.now().toString(36).toUpperCase()}`, startedAt: new Date().toISOString() };
  localStorage.setItem(RECRUITMENT_CYCLE_KEY, JSON.stringify(created));
  return created;
}

export function readActiveRecruitmentContext() {
  return readJson(RECRUITMENT_CONTEXT_KEY, null);
}

export function startRecruitmentCycleContext({ workplace, study }) {
  const cycle = readActiveRecruitmentCycle();
  const context = {
    cycleId: cycle.id,
    workplace: workplace ? { country: workplace.country, stateOrRegion: workplace.stateOrRegion, city: workplace.city, publicFacilityName: workplace.publicFacilityName, publicLocationText: workplace.publicLocationText } : null,
    study: study ? { nctId: study.nctId, title: study.title, sourceUrl: study.studyUrl, retrievedAt: study.retrievedAt } : null,
    selectedAt: new Date().toISOString(),
  };
  localStorage.setItem(RECRUITMENT_CONTEXT_KEY, JSON.stringify(context));
  window.dispatchEvent(new Event(RECRUITMENT_CYCLE_EVENT));
  return context;
}

export function profileName(profile) {
  return (profile?.display_name || `Participant ${profile?.profile_id || ''}`).replace(/\s*\(fictional\)/i, '').trim();
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
  const cleared = new Set(['SYN-001', 'SYN-007', 'SYN-013', 'SYN-014', 'SYN-016', 'SYN-019', 'SYN-020', 'SYN-021', 'SYN-022', 'SYN-023', 'SYN-024', 'SYN-025', 'SYN-026', 'SYN-029']);
  const generatedId = Number(profile.profile_id?.slice(4));
  if (cleared.has(profile.profile_id) || (generatedId >= 31 && generatedId <= 60 && profile.demo_consent && availabilityFor(profile) === 'Available')) return 'Screening workflow cleared';
  if (profile.profile_id === 'SYN-009') return 'Needs study-team follow-up';
  return 'Not reviewed';
}

export function readAiReviewQueue() { return readJson(AI_REVIEW_QUEUE_KEY, {}); }
export function setAiReviewReady({ trialId, profileId, ready }) {
  const key = shortlistKey(trialId, profileId); const queue = readAiReviewQueue();
  const alreadyReady = Boolean(queue[key]);
  if (ready) {
    const readyAt = new Date().toISOString();
    queue[key] = { trialId, profileId, readyAt, status: 'Ready for AI Fit Review' };
    if (!alreadyReady) logActivity({ type: 'screening_ready_for_ai', title: 'Ready for AI Fit Review', href: '/researcher/ai-fit-review', participantId: profileId, trialId, timestamp: readyAt });
  }
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
  localStorage.removeItem(RECRUITMENT_CONTEXT_KEY);
  const nextCycle = { id: `CYCLE-${Date.now().toString(36).toUpperCase()}`, startedAt: new Date().toISOString() };
  localStorage.setItem(RECRUITMENT_CYCLE_KEY, JSON.stringify(nextCycle));
  window.dispatchEvent(new Event(AI_REVIEW_EVENT));
  window.dispatchEvent(new Event(RECRUITMENT_CYCLE_EVENT));
  return nextCycle;
}
import { logActivity } from './activityLog';
