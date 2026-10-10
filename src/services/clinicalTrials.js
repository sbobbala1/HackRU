/**
 * ClinicalTrials.gov API v2 client.
 * API documentation: https://clinicaltrials.gov/data-api/about-api
 * This module is intentionally the only place that calls the public API.
 */
const API = 'https://clinicaltrials.gov/api/v2/studies';
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

/** @typedef {{id:string,nctId:string,title:string,officialTitle:string,summary:string,conditions:string[],status:string,phase:string[],type:string,locations:string[],eligibility:string,minAge:string,maxAge:string,studyUrl:string,source:string,retrievedAt:string}} ClinicalTrial */

const field = (obj, path, fallback) => path.split('.').reduce((v, key) => v?.[key], obj) ?? fallback;
const humanLocations = locations => locations.map(l => [l.facility, l.city, l.state, l.country].filter(Boolean).join(', ')).filter(Boolean);

/** @returns {ClinicalTrial} */
export function normalizeClinicalTrial(study, retrievedAt = new Date().toISOString()) {
  const p = study.protocolSection || {};
  const nctId = field(p, 'identificationModule.nctId', 'Not provided in the source');
  const eligibility = p.eligibilityModule || {};
  return {
    id: nctId, nctId,
    title: field(p, 'identificationModule.briefTitle', 'Not provided in the source'),
    officialTitle: field(p, 'identificationModule.officialTitle', 'Not provided in the source'),
    summary: field(p, 'descriptionModule.briefSummary', 'Not provided in the source'),
    conditions: field(p, 'conditionsModule.conditions', []),
    status: field(p, 'statusModule.overallStatus', 'Not provided in the source'),
    phase: field(p, 'designModule.phases', []),
    type: field(p, 'designModule.studyType', 'Not provided in the source'),
    locations: humanLocations(field(p, 'contactsLocationsModule.locations', [])),
    eligibility: eligibility.eligibilityCriteria || 'Not provided in the source',
    minAge: eligibility.minimumAge || 'Not provided in the source',
    maxAge: eligibility.maximumAge || 'Not provided in the source',
    studyUrl: `https://clinicaltrials.gov/study/${nctId}`,
    source: 'ClinicalTrials.gov API v2', retrievedAt,
    protocolSection: p,
  };
}

async function getJson(url) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.value;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (response.status === 429) throw new Error('ClinicalTrials.gov is rate limiting requests. Please retry shortly.');
    if (!response.ok) throw new Error(`ClinicalTrials.gov request failed (${response.status}).`);
    const value = await response.json(); cache.set(url, { value, savedAt: Date.now() }); return value;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('ClinicalTrials.gov request timed out. Please retry.');
    throw error;
  } finally { clearTimeout(timeout); }
}

export async function searchClinicalTrials({ query = '', location = '', status = '', type = '', minAge = '', maxAge = '', pageToken = '', pageSize = 10 } = {}) {
  const params = new URLSearchParams({ format: 'json', pageSize: String(pageSize) });
  if (query) params.set('query.term', query);
  if (location) params.set('query.locn', location);
  if (status) params.set('filter.overallStatus', status);
  if (pageToken) params.set('pageToken', pageToken);
  const payload = await getJson(`${API}?${params}`), retrievedAt = new Date().toISOString();
  let studies = (payload.studies || []).map(s => normalizeClinicalTrial(s, retrievedAt));
  // The API response contains type and ages when supplied. Filter only those fields
  // with known values; unknown source data is not treated as a negative value.
  if (type) studies = studies.filter(s => s.type === type);
  if (minAge || maxAge) studies = studies.filter(s => {
    const studyMin = Number.parseInt(s.minAge, 10), studyMax = Number.parseInt(s.maxAge, 10);
    if (Number.isNaN(studyMin) || Number.isNaN(studyMax)) return true;
    return (!minAge || studyMax >= Number(minAge)) && (!maxAge || studyMin <= Number(maxAge));
  });
  return { studies, nextPageToken: payload.nextPageToken || null, totalCount: payload.totalCount ?? null, retrievedAt };
}

export async function getClinicalTrial(nctId) {
  if (!/^NCT\d{8}$/i.test(nctId)) throw new Error('Enter a valid NCT identifier.');
  const payload = await getJson(`${API}/${encodeURIComponent(nctId)}`);
  return normalizeClinicalTrial(payload);
}
