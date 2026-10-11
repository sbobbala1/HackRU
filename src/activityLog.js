export const ACTIVITY_LOG_KEY = 'vitra-demo-activity-v1';
export const ACTIVITY_EVENT = 'vitra-demo-activity-change';

export function readActivityLog() {
  try {
    const entries = JSON.parse(localStorage.getItem(ACTIVITY_LOG_KEY) || '[]');
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export function logActivity({ type, title, href, participantId, trialId, publicSite, researcherId = 'demo-researcher', timestamp = new Date().toISOString() }) {
  const entry = {
    id: `${type}:${timestamp}:${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    href,
    participantId,
    trialId,
    publicSite,
    researcherId,
    timestamp,
  };
  const entries = [...readActivityLog(), entry];
  localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(ACTIVITY_EVENT));
  return entry;
}
