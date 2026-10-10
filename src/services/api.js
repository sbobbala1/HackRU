const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || 'Request failed');
  return response.json();
}

export const api = {
  syntheticDemo: () => request('/synthetic/patients/demo'),
  syntheticImport: (bundle) => request('/synthetic/patients/import', {method:'POST', body:JSON.stringify({bundle,synthetic_attested:true})}),
  syntheticMatch: (parsed,bundle) => request('/synthetic/patients/match', {method:'POST', body:JSON.stringify({parsed,bundle,synthetic_attested:true})}),
  health: () => request('/health'),
  matchTrial: (trialId, token) => request(`/trials/${trialId}/matches`, { headers: { Authorization: `Bearer ${token}` } }),
  createTrial: (trial, token) => request('/trials', { method: 'POST', body: JSON.stringify(trial), headers: { Authorization: `Bearer ${token}` } }),
  parseEligibility: (studyId, originalEligibilityText) => request('/eligibility/parse', { method: 'POST', body: JSON.stringify({ study_id: studyId, original_eligibility_text: originalEligibilityText }) }),
  matchEligibility: (parsed, profile) => request('/eligibility/match', { method: 'POST', body: JSON.stringify({ parsed, profile }) }),
  rankEligibility: (studyNctId, sourceUrl, eligibilityText, profiles) => request('/eligibility/rank', { method: 'POST', body: JSON.stringify({ study_nct_id: studyNctId, source_url: sourceUrl, eligibility_text: eligibilityText, profiles }) }),
};
