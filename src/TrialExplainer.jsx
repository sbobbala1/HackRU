import React, {useEffect, useRef, useState} from 'react';
import {getClinicalTrial, searchClinicalTrials} from './services/clinicalTrials';
import {sampleQuestions} from './services/trialExplainer';
import {api} from './services/api';
import './trial-explainer.css';

const OVERVIEW = 'Explain this study in plain English: its purpose, study design, participation activities, and eligibility requirements. Clearly identify any missing information.';
const fieldName = path => path.includes('eligibilityModule') ? 'Participation requirements' : path.includes('descriptionModule') ? 'Study description' : path.includes('armsInterventionsModule') ? 'Study activities' : path.includes('designModule') ? 'Study design' : path.includes('outcomesModule') ? 'Study outcomes' : 'Official study record';

function Answer({answer, title}) {
  const citations=answer.citations || [];
  return <article className="explainer-answer">
    <h3>{title}</h3>
    {answer.notice && <p className="explainer-help">{answer.notice}</p>}
    {answer.status!=='supported' && <p>{answer.answer}</p>}
    {(answer.claims || []).map((claim,i)=><p key={i}>{claim.text} <span className="explainer-citation-links">{claim.source_ids.map(id=><a key={id} href={'#'+title.replace(/\W/g,'')+'-'+id} aria-label={`Read source ${id}`} onClick={()=>{const source=document.getElementById(title.replace(/\W/g,'')+'-'+id);if(source?.parentElement?.tagName==='DETAILS')source.parentElement.open=true;}}>[{id}]</a>)}</span></p>)}
    {citations.length>0 && <details className="explainer-sources"><summary>View original sources ({citations.length})</summary>{citations.map(source=><article id={title.replace(/\W/g,'')+'-'+source.id} key={source.id}><b>[{source.id}] {fieldName(source.path)}</b><blockquote>{source.quote}</blockquote><details><summary>Source field</summary><small>{source.path}</small></details><a href={source.url} target="_blank" rel="noopener noreferrer">Official record</a></article>)}</details>}
  </article>;
}

export default function TrialExplainer({Sidebar, role='patient'}) {
  const [query,setQuery]=useState(''),[results,setResults]=useState([]),[trial,setTrial]=useState(null),[question,setQuestion]=useState('');
  const [overview,setOverview]=useState(null),[reply,setReply]=useState(null),[phase,setPhase]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(null),[searched,setSearched]=useState(false);
  const generation=useRef(0), controller=useRef(null);
  const busy=Boolean(phase);
  function begin(nextPhase) {controller.current?.abort();controller.current=new AbortController();const version=++generation.current;setPhase(nextPhase);setError('');setRetry(null);return {version,signal:controller.current.signal};}
  function current(version){return version===generation.current;}
  useEffect(()=>()=>{generation.current++;controller.current?.abort();},[]);
  async function generate(data,q,kind,request) {
    try {
      const result=await api.explainTrial(data.nctId,q,'en',request.signal);
      if(current(request.version)) {if(kind==='overview')setOverview(result);else setReply({question:q,...result});}
    } catch(e) {if(current(request.version)){setError(e.message);setRetry({data,q,kind});}}
    finally {if(current(request.version))setPhase('');}
  }
  async function select(id) {
    const request=begin('study');setOverview(null);setReply(null);setQuestion('');
    try {
      const data=await getClinicalTrial(id);
      if(!current(request.version))return;
      setTrial(data);setResults([]);setQuery('');setPhase('overview');
      await generate(data,OVERVIEW,'overview',request);
    } catch(e){if(current(request.version)){setError(e.message);setRetry({id});setPhase('');}}
  }
  useEffect(()=>{const id=new URLSearchParams(location.search).get('trial');if(id)select(id);},[]);
  async function search(e) {
    e.preventDefault();if(!query.trim())return;
    if(/^NCT\d{8}$/i.test(query.trim()))return select(query.trim().toUpperCase());
    const request=begin('search');setSearched(false);
    try {const data=await searchClinicalTrials({query:query.trim(),pageSize:5});if(current(request.version)){setResults(data.studies);setSearched(true);}}
    catch(e){if(current(request.version))setError(e.message);}finally{if(current(request.version))setPhase('');}
  }
  async function ask(q=question) {if(!trial||!q.trim()||busy)return;setQuestion(q);setReply(null);await generate(trial,q.trim(),'question',begin('answer'));}
  function retryRequest(){if(!retry)return;if(retry.id)select(retry.id);else generate(retry.data,retry.q,retry.kind,begin(retry.kind==='overview'?'overview':'answer'));}
  function changeStudy(){generation.current++;controller.current?.abort();setTrial(null);setOverview(null);setReply(null);setResults([]);setQuestion('');setError('');setRetry(null);setSearched(false);setPhase('');}
  return <div className="portal"><Sidebar role={role}/><main className="portal-main explainer-page">
    <div className="page-head"><div><span className="eyebrow">{role==='researcher'?'Researcher workspace':'Patient workspace'}</span><h1>Trial explainer</h1><p>Choose a study, read a short overview, then ask a question.</p></div></div>
    {!trial && <section className="explainer-discovery"><form onSubmit={search} className="explainer-search"><label htmlFor="trial-search">Find a real clinical trial</label><div><input id="trial-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Condition, keyword, or NCT ID" disabled={busy} required/><button className="btn primary" disabled={busy}>Search</button></div></form>
      {phase==='search'&&<p role="status">Searching ClinicalTrials.gov...</p>}{phase==='study'&&<p role="status">Opening the selected study...</p>}
      {searched&&!results.length&&<p>No studies found. Try a broader condition or keyword.</p>}
      {results.length>0&&<section aria-label="Search results">{results.map(t=><article className="explainer-result" key={t.nctId}><h2>{t.title}</h2><p>{t.nctId} · {t.status}</p><button className="btn secondary" disabled={busy} onClick={()=>select(t.nctId)}>{phase==='study'?'Opening study...':'Explain this study'}</button></article>)}</section>}
    </section>}
    {trial&&<><section className="explainer-record"><div className="explainer-record-heading"><div><span className="eyebrow">Selected study</span><h2>{trial.title}</h2><p>{trial.nctId} · {trial.status}</p></div><button className="btn secondary" onClick={changeStudy}>Change study</button></div><p>{trial.source} · Retrieved {trial.retrievedAt}</p><a href={trial.studyUrl} target="_blank" rel="noopener noreferrer">View official trial record</a></section>
      <section className="explainer-overview" aria-live="polite"><h2>Study overview</h2>{phase==='overview'?<p role="status">AI is reading the study and preparing a short overview...</p>:overview?<Answer answer={overview} title="About this study"/>:<p>The overview will appear here.</p>}</section>
      <section className="explainer-questions"><h2>Ask a question</h2><div className="explainer-samples">{sampleQuestions.map(q=><button key={q} className="btn secondary" disabled={busy} onClick={()=>ask(q)}>{q}</button>)}</div><form onSubmit={e=>{e.preventDefault();ask();}}><label htmlFor="trial-question">What would you like to know?</label><textarea id="trial-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={2000} placeholder="For example: What tests would participants have?" disabled={busy} required/><button className="btn primary" disabled={busy||!question.trim()}>{phase==='answer'?'Preparing answer...':'Ask question'}</button></form><p className="explainer-help">English only. Your question and the public trial record are sent to AI. Do not enter real medical records.</p>
      </section>
      <section className="explainer-reply" aria-live="polite"><h2>Your answer</h2>{phase==='answer'?<p role="status">Reading the trial record for your question...</p>:reply?<><p className="explainer-question-text">{reply.question}</p><Answer answer={reply} title="Answer"/></>:<p>Ask a question above to see the answer here.</p>}</section>
    </>}
    {error&&<div role="alert" className="explainer-error"><b>We could not complete that request.</b><p>{error}</p>{retry&&<button className="btn secondary" disabled={busy} onClick={retryRequest}>Try again</button>}</div>}
    <p className="explainer-help">AI explanations can make mistakes. Verify details using the cited sources. The study team must confirm eligibility.</p>
  </main></div>;
}
