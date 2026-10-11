/**
 * ClinicalTrials.gov API v2 client.
 * API documentation: https://clinicaltrials.gov/data-api/about-api
 * This module is intentionally the only place that calls the public API.
 */
const API = 'https://clinicaltrials.gov/api/v2/studies';
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();
import snapshots from '../../backend/app/data/trial_snapshots.json' with { type: 'json' };
import { demoMode } from './demoMode.js';

/** @typedef {{id:string,nctId:string,title:string,officialTitle:string,summary:string,conditions:string[],status:string,phase:string[],type:string,locations:string[],locationDetails:{facility:string,city:string,stateOrRegion:string,country:string,postalCode:string,publicLocationText:string}[],eligibility:string,minAge:string,maxAge:string,studyUrl:string,source:string,retrievedAt:string}} ClinicalTrial */

const field = (obj, path, fallback) => path.split('.').reduce((v, key) => v?.[key], obj) ?? fallback;
export const normalizePublicLocations = (locations = []) => locations.map(location => {
  const facility = location?.facility || '';
  const city = location?.city || '';
  const stateOrRegion = location?.state || location?.region || '';
  const country = location?.country || '';
  const postalCode = location?.zip || location?.postalCode || '';
  const publicLocationText = [facility || 'Facility name not provided in the public source', city, stateOrRegion, country].filter(Boolean).join(', ');
  return { facility, city, stateOrRegion, country, postalCode, publicLocationText };
}).filter(location => location.city || location.stateOrRegion || location.country || location.facility);
const humanLocations = locations => normalizePublicLocations(locations).map(location => location.publicLocationText);

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
    locationDetails: normalizePublicLocations(field(p, 'contactsLocationsModule.locations', [])),
    eligibility: eligibility.eligibilityCriteria || 'Not provided in the source',
    minAge: eligibility.minimumAge || 'Not provided in the source',
    maxAge: eligibility.maximumAge || 'Not provided in the source',
    studyUrl: `https://clinicaltrials.gov/study/${nctId}`,
    source: study._vitraCached ? 'Cached ClinicalTrials.gov snapshot (demo fallback)' : 'ClinicalTrials.gov API v2',
    cached: Boolean(study._vitraCached), retrievedAt: study._vitraRetrievedAt || retrievedAt,
    protocolSection: p,
    resultsSection: study.resultsSection,
  };
}

async function getJson(url) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.value;
  function fallback() {
    const parsed = new URL(url);
    const id = parsed.pathname.split('/').at(-1);
    const records = snapshots.records.map(r => ({...r, _vitraCached: true, _vitraRetrievedAt: snapshots.retrieved_at}));
    if (/^NCT\d{8}$/i.test(id)) return records.find(r => r.protocolSection.identificationModule.nctId === id.toUpperCase());
    const query = (parsed.searchParams.get('query.term') || '').toLowerCase();
    const location = (parsed.searchParams.get('query.locn') || '').toLowerCase();
    const status = parsed.searchParams.get('filter.overallStatus');
    return {studies: records.filter(r => JSON.stringify(r.protocolSection).toLowerCase().includes(query) &&
      (!location || JSON.stringify(r.protocolSection.contactsLocationsModule || {}).toLowerCase().includes(location)) &&
      (!status || status.split(',').includes(r.protocolSection.statusModule.overallStatus))), cached: true};
  }
  if (demoMode) {
    const value = fallback();
    if (!value) throw new Error('This study is not bundled in deterministic demo mode. Choose one of the three cached studies.');
    return value;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (response.status === 429) throw new Error('ClinicalTrials.gov is rate limiting requests. Please retry shortly.');
    if (!response.ok) throw new Error(`ClinicalTrials.gov request failed (${response.status}).`);
    const value = await response.json(); cache.set(url, { value, savedAt: Date.now() }); return value;
  } catch (error) {
    const value = fallback();
    if (value && (!value.studies || value.studies.length)) return value;
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
  const payload = await getJson(`${API}?${params}`), retrievedAt = payload.cached ? snapshots.retrieved_at : new Date().toISOString();
  let studies = (payload.studies || []).map(s => normalizeClinicalTrial(s, retrievedAt));
  // The API response contains type and ages when supplied. Filter only those fields
  // with known values; unknown source data is not treated as a negative value.
  if (type) studies = studies.filter(s => s.type === type);
  if (minAge || maxAge) studies = studies.filter(s => {
    const years = value => /^(\d+) Years?$/i.exec(value || '')?.[1];
    const studyMin = Number(years(s.minAge) ?? NaN), studyMax = Number(years(s.maxAge) ?? NaN);
    if (Number.isNaN(studyMin) || Number.isNaN(studyMax)) return true;
    return (!minAge || studyMax >= Number(minAge)) && (!maxAge || studyMin <= Number(maxAge));
  });
  return { studies, nextPageToken: payload.nextPageToken || null, totalCount: payload.totalCount ?? null, retrievedAt,
    cached: Boolean(payload.cached), source: payload.cached ? 'Cached ClinicalTrials.gov snapshots (demo fallback)' : 'ClinicalTrials.gov API v2' };
}

export async function getClinicalTrial(nctId) {
  if (!/^NCT\d{8}$/i.test(nctId)) throw new Error('Enter a valid NCT identifier.');
  const payload = await getJson(`${API}/${encodeURIComponent(nctId)}`);
  if (payload?.protocolSection?.identificationModule?.nctId !== nctId.toUpperCase()) throw new Error('The source record does not match the selected study.');
  return normalizeClinicalTrial(payload);
}
