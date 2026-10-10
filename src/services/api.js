const API_URL = (import.meta.env?.VITE_API_URL || (import.meta.env?.DEV ? '/api' : 'http://localhost:8000')).replace(/\/$/, '');

async function request(path, options = {}) {
  const { signal: callerSignal, ...rest } = options;
  const signal = callerSignal ? AbortSignal.any([callerSignal, AbortSignal.timeout(65000)]) : AbortSignal.timeout(65000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...rest, signal,
      headers: { 'Content-Type': 'application/json', ...rest.headers },
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => ({}))).detail;
      const fallback = [502, 503, 504].includes(response.status)
        ? 'The Vitra backend is unavailable. Restart npm.cmd run dev from the project folder and try again.'
        : 'The request could not be processed. Please retry.';
      throw new Error(typeof detail === 'string' ? detail : fallback);
    }
    return await response.json();
  } catch (error) {
    if (callerSignal?.aborted) throw error;
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('The request took too long. Please try again.');
    if (error instanceof TypeError) throw new Error('Cannot reach the Vitra API. Start the backend and try again.');
    throw error;
  }
}

export const api = {
  syntheticDemo: () => request('/synthetic/patients/demo'),
  syntheticImport: (bundle) => request('/synthetic/patients/import', {method:'POST', body:JSON.stringify({bundle,synthetic_attested:true})}),
  syntheticMatch: (parsed,bundle) => request('/synthetic/patients/match', {method:'POST', body:JSON.stringify({parsed,bundle,synthetic_attested:true})}),
  explainTrial: (nctId,question,language='en',signal) => request('/trials/explain', {method:'POST',signal,body:JSON.stringify({nct_id:nctId,question,language})}),
  health: () => request('/health'),
  matchTrial: (trialId, token) => request(`/trials/${trialId}/matches`, { headers: { Authorization: `Bearer ${token}` } }),
  createTrial: (trial, token) => request('/trials', { method: 'POST', body: JSON.stringify(trial), headers: { Authorization: `Bearer ${token}` } }),
  parseEligibility: (studyId, originalEligibilityText) => request('/eligibility/parse', { method: 'POST', body: JSON.stringify({ study_id: studyId, original_eligibility_text: originalEligibilityText }) }),
  matchEligibility: (parsed, profile) => request('/eligibility/match', { method: 'POST', body: JSON.stringify({ parsed, profile }) }),
  rankEligibility: (studyNctId, sourceUrl, eligibilityText, profiles) => request('/eligibility/rank', { method: 'POST', body: JSON.stringify({ study_nct_id: studyNctId, source_url: sourceUrl, eligibility_text: eligibilityText, profiles }) }),
};
