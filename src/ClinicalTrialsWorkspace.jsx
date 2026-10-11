import React, { useEffect, useMemo, useState } from 'react';
import { searchClinicalTrials } from './services/clinicalTrials';
import { api } from './services/api';
import WorkplaceBadge from './WorkplaceBadge';
import { locationMatchesWorkplace, publicSitesFromStudies, readWorkplace } from './researcherWorkspace';
import './clinical-trials-workspace.css';

const STUDY_IDS = ['NCT05564039', 'NCT05025787', 'NCT04791371'];
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

  useEffect(() => {
    const sync = () => setWorkplace(readWorkplace());
    window.addEventListener('vitra-workplace-change', sync);
    return () => window.removeEventListener('vitra-workplace-change', sync);
  }, []);

  useEffect(() => {
    let active = true;
    searchClinicalTrials({ pageSize: 50 })
      .then(result => {
        if (!active) return;
        setStudies(result.studies);
        setSelectedStudyId(result.studies[0]?.nctId || '');
      })
      .catch(reason => active && setError(reason.message));
    return () => { active = false; };
  }, []);

  const sites = useMemo(
    () => publicSitesFromStudies(studies).filter(item => locationMatchesWorkplace(item, workplace, scope)),
    [studies, workplace, scope],
  );
  const visible = useMemo(() => studies.filter(study => (
    (status === 'all' || study.status === status)
    && (type === 'all' || study.type === type)
    && (!keyword || `${study.title} ${study.conditions?.join(' ')}`.toLowerCase().includes(keyword.toLowerCase()))
    && (site === 'all' || study.locationDetails?.some(item => item.publicLocationText === site))
    && study.locationDetails?.some(item => locationMatchesWorkplace(item, workplace, scope))
  )), [studies, status, type, keyword, site, workplace, scope]);
  const selectedStudy = studies.find(study => study.nctId === selectedStudyId) || visible[0] || studies[0];
  const broadened = scope !== 'exact';

  function chooseStudy(study) {
    setSelectedStudyId(study.nctId);
    setAnswer(null);
    setQuestion('');
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
      setError('The live explainer service is unavailable, so Vitra is showing the selected public record text directly.');
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
      <label>Recruitment status<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{[...new Set(studies.map(study => study.status))].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Study type<select value={type} onChange={event => setType(event.target.value)}><option value="all">All study types</option>{[...new Set(studies.map(study => study.type))].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Search area<select value={scope} onChange={event => { setScope(event.target.value); setSite('all'); }}><option value="exact">Exact public workplace</option><option value="city">Broaden to city</option><option value="state">Broaden to state / region</option><option value="country">Broaden to country</option></select></label>
      <label>Public hospital / clinic site<select value={site} onChange={event => setSite(event.target.value)}><option value="all">All public sites in search area</option>{sites.map(value => <option key={value.publicLocationText} value={value.publicLocationText}>{value.facility || 'Facility name not provided in the public source'} · {value.city || value.stateOrRegion || value.country}</option>)}</select></label>
    </section>
    {!studies.length && !error && <div className="empty">Loading ClinicalTrials.gov records…</div>}
    <section className="clinical-trials-content">
      <div className="clinical-study-list">{visible.map(study => {
        const publicSites = (study.locationDetails || []).filter(item => locationMatchesWorkplace(item, workplace, scope));
        const active = selectedStudy?.nctId === study.nctId;
        return <article key={study.nctId} className={active ? 'selected-study' : ''}><div><span className="eyebrow">{study.nctId} · {study.status}</span><h2>{study.title}</h2><p>{study.summary}</p><p><b>Conditions:</b> {study.conditions?.join(', ') || 'Not provided'} · <b>Type:</b> {study.type || 'Not provided'} · <b>Phase:</b> {study.phase?.join(', ') || 'Not provided'}</p><small>Source: {study.source} · retrieved {new Date(study.retrievedAt).toLocaleString()}</small></div><aside><b>Public listed sites</b><p>{publicSites.slice(0, 4).map(item => item.publicLocationText).join(' · ') || 'No public site in the selected workplace area'}</p><a href={study.studyUrl} target="_blank" rel="noreferrer">Open ClinicalTrials.gov record ↗</a><button className="btn secondary" onClick={() => chooseStudy(study)}>{active ? 'Selected for chat' : 'Ask about this study'}</button></aside></article>;
      })}</div>
      <aside className="clinical-trial-chat" aria-label="Trial explainer chat">
        <div className="clinical-chat-heading"><span className="eyebrow">Trial explainer</span><h2>Ask about a study</h2><p>{selectedStudy ? `${selectedStudy.nctId} · ${selectedStudy.title}` : 'Select a listed public study to begin.'}</p></div>
        {selectedStudy && <><div className="clinical-chat-quick">{QUICK_QUESTIONS.map(item => <button key={item} type="button" disabled={answering} onClick={() => ask(null, item)}>{item}</button>)}</div><form onSubmit={ask}><label htmlFor="clinical-trial-question">Your question</label><textarea id="clinical-trial-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask about the selected public study…" maxLength={2000} disabled={answering}/><button className="btn" disabled={answering || !question.trim()}>{answering ? 'Reading source…' : 'Ask question'}</button></form></>}
        <div className="clinical-chat-answer" aria-live="polite">{answering ? <p>Reviewing the selected public record…</p> : answer ? <><b>Source-linked answer</b><p>{answer.answer}</p>{answer.claims?.map((claim, index) => <p key={index} className="clinical-chat-claim">{claim.text} <small>[{claim.source_ids?.join(', ')}]</small></p>)}{answer.citations?.length > 0 && <details><summary>View cited record sections ({answer.citations.length})</summary>{answer.citations.map(citation => <p key={citation.id}><b>[{citation.id}]</b> {citation.quote}</p>)}</details>}</> : <p>Select a study and ask a question. Answers stay tied to the ClinicalTrials.gov record shown here.</p>}</div>
        <small>AI explanations can be wrong. Verify details in the cited public record. A study team conducts screening and confirms eligibility.</small>
      </aside>
    </section>
    {studies.length && !visible.length && <div className="empty"><b>No loaded public ClinicalTrials.gov study sites match this exact workplace context.</b><p>You can broaden to city, state / region, country, or all public locations in Data & Sites.</p></div>}
  </main></div>;
}
