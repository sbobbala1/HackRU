import { api } from './services/api';
import { auth, firebaseEnabled, getCurrentUser } from './services/firebase';

const KEY = 'vitra-finalist-selections-v1';
const EVENT = 'vitra-finalists-change';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = value => { localStorage.setItem(KEY, JSON.stringify(value)); window.dispatchEvent(new Event(EVENT)); };
export const finalistEvent = EVENT;
export const finalistKey = ({ researcherId, profileId, trialId, publicSite }) => [researcherId, profileId, trialId, publicSite || 'public-site-not-provided'].join('::');
export const isSelectableFinalist = ({ profile, result, stage }) => Boolean(profile?.demo_consent) && (profile?.availability || 'Available') === 'Available' && result?.outcome === 'Potential Match' && stage === 'Screening workflow cleared';
export const readFinalistSelections = () => read();

export async function selectFinalist({ profile, study, result, publicSite, stage }) {
  if (!isSelectableFinalist({ profile, result, stage })) throw new Error('Only available, consented fictional Potential Match records ready for researcher follow-up can be selected.');
  const user = getCurrentUser(); const researcherId = user?.uid || 'demo-researcher';
  const record = { researcherId, profileId: profile.profile_id, trialId: study.nctId, trialTitle: study.title, publicSite: publicSite || 'Public site context not provided', consent: true, availability: 'Available', deterministicOutcome: 'Potential Match', counts: result.counts, sourceRetrievedAt: study.retrievedAt, selectedAt: new Date().toISOString(), selectedBy: user?.displayName || user?.email || 'Researcher demo workspace', selectionStatus: 'Finalist selected', outreachDraftStatus: 'Draft created' };
  const key = finalistKey(record); write({ ...read(), [key]: record });
  if (firebaseEnabled && auth?.currentUser) { try { const saved = await api.saveFinalist(record, await auth.currentUser.getIdToken()); if (saved?.id) { record.remoteId = saved.id; write({ ...read(), [key]: record }); } } catch { /* local demo continuity remains available */ } }
  return { key, record };
}

export async function removeFinalist(record) {
  const key = finalistKey(record); const next = read(); delete next[key]; write(next);
  if (firebaseEnabled && auth?.currentUser && record.remoteId) { try { await api.removeFinalist(record.remoteId, await auth.currentUser.getIdToken()); } catch { /* local demo continuity remains available */ } }
}
