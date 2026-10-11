import React, { useEffect, useMemo, useState } from 'react';
import { searchClinicalTrials } from './services/clinicalTrials';
import { api } from './services/api';
import WorkplaceBadge from './WorkplaceBadge';
import { locationMatchesWorkplace, publicSitesFromStudies, readWorkplace } from './researcherWorkspace';
import './clinical-trials-workspace.css';

const QUICK_QUESTIONS = [
  'What is the purpose of this study?',
  'What participation requirements are listed?',
  'What activities are described for participants?',
];
const localSourceAnswer = (study, question) => {
  const q = question.toLowerCase();
  const needs = /require|eligible|particip|criteria/.test(q) ? study.eligibility : study.summary;
  const heading = /require|eligible|particip|criteria/.test(q) ? 'Eligibility criteria' : 'Study summary';
  const quote = needs && needs !== 'Not provided in the source' ? needs : 'The selected public record does not provide that detail.';
  return { answer: `Here is the available ${heading.toLowerCase()} from the selected public record.`, claims: [{ text: quote, source_ids: ['S1'] }], citations: [{ id: 'S1', quote, label: heading }] };
};

export default function ClinicalTrialsWorkspace({ Sidebar }) {
  const [studies, setStudies] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [searchMode, setSearchMode] = useState('condition');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [site, setSite] = useState('all');
  const [scope, setScope] = useState('exact');
  const [workplace, setWorkplace] = useState(readWorkplace);
  const [error, setError] = useState('');
  const [selectedStudyId, setSelectedStudyId] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [answering, setAnswering] = useState(false);
  const [loadingStudies, setLoadingStudies] = useState(false);
  const [detailStudy, setDetailStudy] = useState(null);

  useEffect(() => {
    const sync = () => setWorkplace(readWorkplace());
    window.addEventListener('vitra-workplace-change', sync);
    return () => window.removeEventListener('vitra-workplace-change', sync);
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoadingStudies(true); setError('');
      searchClinicalTrials({ query: keyword, queryMode: searchMode, status: status === 'all' ? '' : status, type: type === 'all' ? '' : type, pageSize: 50 })
        .then(result => {
          if (!active) return;
          setStudies(result.studies);
          setSelectedStudyId(current => result.studies.some(study => study.nctId === current) ? current : result.studies[0]?.nctId || '');
        })
        .catch(reason => active && setError(reason.message))
        .finally(() => active && setLoadingStudies(false));
    }, keyword ? 300 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [keyword, searchMode, status, type]);

  const matchesKeyword = study => {
    if (!keyword || searchMode === 'condition') return true;
    const text = [study.title, study.officialTitle, study.summary, study.eligibility, ...(study.conditions || [])].join(' ').toLowerCase();
    return text.includes(keyword.trim().toLowerCase());
  };

  const sites = useMemo(
    () => publicSitesFromStudies(studies).filter(item => locationMatchesWorkplace(item, workplace, scope)),
    [studies, workplace, scope],
  );
  const visible = useMemo(() => studies.filter(study => (
    (status === 'all' || study.status === status)
    && (type === 'all' || study.type === type)
    && matchesKeyword(study)
    && (site === 'all' || study.locationDetails?.some(item => item.publicLocationText === site))
    && study.locationDetails?.some(item => locationMatchesWorkplace(item, workplace, scope))
  )), [studies, status, type, keyword, searchMode, site, workplace, scope]);
  // Discovery should still be useful when the selected workplace has no result for a typed condition.
  // In that case we show matching public records and label them as outside the workplace context.
  const broadMatches = useMemo(() => studies.filter(study => (
    (status === 'all' || study.status === status)
    && (type === 'all' || study.type === type)
    && matchesKeyword(study)
  )), [studies, status, type, keyword, searchMode]);
  const listedStudies = visible.length ? visible : broadMatches;
  const showingBroaderResults = !visible.length && broadMatches.length > 0;
  const selectedStudy = listedStudies.find(study => study.nctId === selectedStudyId) || listedStudies[0] || studies.find(study => study.nctId === selectedStudyId) || studies[0];
  const broadened = scope !== 'exact';

  function chooseStudy(study) {
    setSelectedStudyId(study.nctId);
    setAnswer(null);
    setQuestion('');
  }

  function openDetails(study) {
    chooseStudy(study);
    setDetailStudy(study);
  }

  function generateStudyPdf(study) {
    const escapeHtml = value => String(value || 'Not provided in the public record').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    const sites = (study.locationDetails || []).map(item => item.publicLocationText).filter(Boolean).join('<br>') || 'No public study sites were provided.';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.opener = null;
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(study.nctId)} study details</title><style>body{font-family:Arial,sans-serif;color:#193b34;max-width:850px;margin:42px auto;padding:0 28px;line-height:1.55}h1{font-size:26px;margin:6px 0 18px}h2{font-size:17px;margin:28px 0 8px;border-bottom:1px solid #d9e7e1;padding-bottom:7px}.tag{color:#19735e;font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase}.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;background:#f4faf7;padding:16px;border-radius:10px}.meta b{display:block;font-size:11px;text-transform:uppercase;color:#527167;margin-bottom:3px}pre{white-space:pre-wrap;font:13px/1.6 Arial,sans-serif;background:#f7faf8;border:1px solid #dce9e3;padding:16px;border-radius:9px}a{color:#176b59}@media print{body{margin:0 auto}}</style></head><body><div class="tag">ClinicalTrials.gov public study record</div><h1>${escapeHtml(study.title)}</h1><p><b>${escapeHtml(study.nctId)}</b> · Retrieved ${escapeHtml(new Date(study.retrievedAt).toLocaleString())}</p><div class="meta"><div><b>Recruitment status</b>${escapeHtml(study.status)}</div><div><b>Study type / phase</b>${escapeHtml(study.type)} · ${escapeHtml(study.phase?.join(', ') || 'Not provided')}</div><div><b>Age range</b>${escapeHtml(study.minAge)} to ${escapeHtml(study.maxAge)}</div><div><b>Conditions</b>${escapeHtml(study.conditions?.join(', ') || 'Not provided')}</div></div><h2>What the study says will take place</h2><p>${escapeHtml(study.summary)}</p><h2>Eligibility and participation requirements</h2><pre>${escapeHtml(study.eligibility)}</pre><h2>Public listed study sites</h2><p>${sites}</p><h2>Official source</h2><p><a href="${escapeHtml(study.studyUrl)}">${escapeHtml(study.studyUrl)}</a></p><p><small>Generated from the public record. Confirm details with the official ClinicalTrials.gov listing and study team.</small></p></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  }

  async function ask(event, promptedQuestion = question) {
    event?.preventDefault();
    if (!selectedStudy || !promptedQuestion.trim() || answering) return;
    setQuestion(promptedQuestion);
    setAnswer(null);
    setAnswering(true);
    setError('');
    try {
      const response = await api.explainTrial(selectedStudy.nctId, promptedQuestion.trim());
      setAnswer(response);
    } catch (reason) {
      setAnswer(localSourceAnswer(selectedStudy, promptedQuestion));
      setQuestion('');
    } finally {
      setAnswering(false);
    }
  }

  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main clinical-trials-workspace">
    <div className="page-head"><div><span className="eyebrow">Recruitment workflow · public study discovery</span><h1>Clinical Trials</h1><p>Browse public ClinicalTrials.gov studies around the selected workplace and ask source-linked questions beside the listings.</p></div><WorkplaceBadge/></div>
    <div className="notice"><span><b>Public-source discovery only.</b> {studies.length ? `${studies.length} public ClinicalTrials.gov studies are loaded for searching.` : 'Loading public ClinicalTrials.gov studies…'} Hospital and clinic names are shown only when supplied by ClinicalTrials.gov. The trial chat summarizes the selected public record; it does not decide eligibility or medical suitability.</span></div>
    {broadened && <div className="notice"><span><b>Broadened search:</b> Results are currently shown at the selected {scope} level rather than the exact public workplace context.</span></div>}
    {error && <div className="form-error">{error}</div>}
    <section className="clinical-trial-controls">
      <label>Condition or keyword<input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="e.g. diabetes"/></label>
      <label>Search in<select value={searchMode} onChange={event => setSearchMode(event.target.value)}><option value="condition">Condition / disease</option><option value="keyword">All study details</option></select></label>
      <label>Recruitment status<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{[...new Set(studies.map(study => study.status))].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Study type<select value={type} onChange={event => setType(event.target.value)}><option value="all">All study types</option>{[...new Set(studies.map(study => study.type))].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Search area<select value={scope} onChange={event => { setScope(event.target.value); setSite('all'); }}><option value="exact">Exact public workplace</option><option value="city">Broaden to city</option><option value="state">Broaden to state / region</option><option value="country">Broaden to country</option><option value="all">All public locations</option></select></label>
      <label>Public hospital / clinic site<select value={site} onChange={event => setSite(event.target.value)}><option value="all">All public sites in search area</option>{sites.map(value => <option key={value.publicLocationText} value={value.publicLocationText}>{value.facility || 'Facility name not provided in the public source'} · {value.city || value.stateOrRegion || value.country}</option>)}</select></label>
    </section>
    {loadingStudies && <div className="empty">Searching ClinicalTrials.gov records…</div>}{!studies.length && !error && !loadingStudies && <div className="empty">Loading ClinicalTrials.gov records…</div>}
    {showingBroaderResults && <div className="notice clinical-broadened-results"><span><b>No matching studies are loaded for the exact workplace context.</b> Showing {listedStudies.length} matching public study record{listedStudies.length === 1 ? '' : 's'} from the broader search so you can review the study details.</span></div>}
    <section className="clinical-trials-content">
      <div className="clinical-study-list">{listedStudies.map(study => {
        const publicSites = (study.locationDetails || []).filter(item => locationMatchesWorkplace(item, workplace, scope));
        const active = selectedStudy?.nctId === study.nctId;
        return <article key={study.nctId} className={active ? 'selected-study' : ''}><div><span className="eyebrow">{study.nctId} · {study.status}</span><h2>{study.title}</h2><p>{study.summary}</p><p><b>Conditions:</b> {study.conditions?.join(', ') || 'Not provided'} · <b>Type:</b> {study.type || 'Not provided'} · <b>Phase:</b> {study.phase?.join(', ') || 'Not provided'}</p><small>Source: {study.source} · retrieved {new Date(study.retrievedAt).toLocaleString()}</small></div><aside><b>Public listed sites</b><p>{publicSites.slice(0, 4).map(item => item.publicLocationText).join(' · ') || (study.locations || []).slice(0, 4).join(' · ') || 'No public site provided in the source record'}</p><a href={study.studyUrl} target="_blank" rel="noreferrer">Open ClinicalTrials.gov record ↗</a><button className="btn secondary" onClick={() => openDetails(study)}>Learn more</button><button className="btn secondary" onClick={() => chooseStudy(study)}>{active ? 'Selected for chat' : 'Ask about this study'}</button></aside></article>;
      })}</div>
      <aside className="clinical-trial-chat" aria-label="Trial explainer chat">
        <div className="clinical-chat-heading"><span className="eyebrow">Trial explainer</span><h2>Ask about a study</h2><p>{selectedStudy ? `${selectedStudy.nctId} · ${selectedStudy.title}` : 'Select a listed public study to begin.'}</p></div>
        {selectedStudy && <><div className="clinical-chat-quick">{QUICK_QUESTIONS.map(item => <button key={item} type="button" disabled={answering} onClick={() => ask(null, item)}>{item}</button>)}</div><form onSubmit={ask}><label htmlFor="clinical-trial-question">Your question</label><textarea id="clinical-trial-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask about the selected public study…" maxLength={2000} disabled={answering}/><button className="btn" disabled={answering || !question.trim()}>{answering ? 'Reading source…' : 'Ask question'}</button></form></>}
        <div className="clinical-chat-answer" aria-live="polite">{answering ? <p>Reviewing the selected public record…</p> : answer ? <><b>Source-linked answer</b><p>{answer.answer}</p>{answer.claims?.map((claim, index) => <p key={index} className="clinical-chat-claim">{claim.text} <small>[{claim.source_ids?.join(', ')}]</small></p>)}{answer.citations?.length > 0 && <details><summary>View cited record sections ({answer.citations.length})</summary>{answer.citations.map(citation => <p key={citation.id}><b>[{citation.id}]</b> {citation.quote}</p>)}</details>}</> : <p>Select a study and ask a question. Answers stay tied to the ClinicalTrials.gov record shown here.</p>}</div>
        <small>AI explanations can be wrong. Verify details in the cited public record. A study team conducts screening and confirms eligibility.</small>
      </aside>
    </section>
    {detailStudy && <div className="study-detail-modal" role="dialog" aria-modal="true" aria-labelledby="study-detail-title"><section><button className="study-detail-close" aria-label="Close study details" onClick={() => setDetailStudy(null)}>×</button><span className="eyebrow">Public study details</span><h2 id="study-detail-title">{detailStudy.title}</h2><p><b>{detailStudy.nctId}</b> · {detailStudy.status} · {detailStudy.type}{detailStudy.phase?.length ? ` · ${detailStudy.phase.join(', ')}` : ''}</p><div className="study-detail-actions"><button className="btn" onClick={() => generateStudyPdf(detailStudy)}>Generate PDF</button><a className="btn secondary" href={detailStudy.studyUrl} target="_blank" rel="noreferrer">Official record ↗</a></div><div className="study-detail-grid"><section><h3>What will take place</h3><p>{detailStudy.summary}</p><h3>Eligibility & requirements</h3><pre>{detailStudy.eligibility}</pre></section><aside><h3>Study at a glance</h3><p><b>Conditions</b><br/>{detailStudy.conditions?.join(', ') || 'Not provided'}</p><p><b>Age range</b><br/>{detailStudy.minAge} to {detailStudy.maxAge}</p><p><b>Public listed sites</b><br/>{(detailStudy.locations || []).join(' · ') || 'Not provided in the public record'}</p><small>Source: {detailStudy.source} · retrieved {new Date(detailStudy.retrievedAt).toLocaleString()}</small></aside></div></section></div>}
  </main></div>;
}
