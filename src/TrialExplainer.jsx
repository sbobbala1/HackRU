import React, {useEffect, useRef, useState} from 'react';
import {getClinicalTrial,searchClinicalTrials} from './services/clinicalTrials';
import {explainTrial,sampleQuestions} from './services/trialExplainer';
import {api} from './services/api';
import './trial-explainer.css';

export default function TrialExplainer({Sidebar, role='patient'}) {
  const [query,setQuery]=useState(''),[results,setResults]=useState([]),[trial,setTrial]=useState(null),[question,setQuestion]=useState(''),[answer,setAnswer]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[language,setLanguage]=useState('en');
  const generation=useRef(0); const answerRef=useRef(null);
  const overviewQuestion = 'Explain this study in plain English: its purpose, study design, participation activities, and eligibility requirements. Clearly identify any missing information.';
  async function requestAnswer(data, q, version) {
    setQuestion(q); setAnswer(null);
    try {
      const response = await api.explainTrial(data.nctId,q,language);
      if(version===generation.current) setAnswer({question:q,guidance:'This explains the public study record. Official screening is required. It is not treatment advice.',...response});
    } catch(e) {
      if(version===generation.current) {
        setError(e.message + ' No AI answer was generated.');
        const fallback=explainTrial(data,q,language);
        if(fallback.citations.length) setAnswer({...fallback,method:'Original source excerpts only: AI request failed'});
      }
    }
  }
  async function select(id) {
    const version=++generation.current;setBusy(true);setError('');setTrial(null);setAnswer(null);
    try {
      const data=await getClinicalTrial(id);
      if(version!==generation.current)return;
      setTrial(data);setQuery(data.nctId);setResults([]);
      await requestAnswer(data,overviewQuestion,version);
    } catch(e){if(version===generation.current)setError(e.message);}
    finally{if(version===generation.current)setBusy(false);}
  }
  useEffect(()=>{const id=new URLSearchParams(location.search).get('trial');if(id)select(id);},[]);
  async function search(e){e.preventDefault();if(/^NCT\d{8}$/i.test(query.trim()))return select(query.trim().toUpperCase());const version=++generation.current;setBusy(true);setError('');setAnswer(null);try{const data=await searchClinicalTrials({query,pageSize:5});if(version===generation.current){setResults(data.studies);if(!data.studies.length)setError('No studies found. Try a broader search.');}}catch(e){if(version===generation.current)setError(e.message);}finally{if(version===generation.current)setBusy(false);}}
  async function ask(q=question){if(!trial || !q.trim())return;const version=++generation.current;setBusy(true);setError('');try{await requestAnswer(trial,q,version);}finally{if(version===generation.current)setBusy(false);}}
  useEffect(()=>{if(answer)answerRef.current?.focus();answerRef.current?.scrollIntoView({block:'start'});},[answer]);
  return <div className="portal"><Sidebar role={role}/><main className="portal-main explainer-page"><div className="page-head"><div><span className="eyebrow">{role==='researcher'?'Doctor / researcher workspace':'Patient workspace'}</span><h1>Trial explainer</h1><p>Understand a real study using its public record and trace every answer to its source.</p></div></div>
    <form onSubmit={search} className="explainer-search"><label htmlFor="trial-search">Find a study by condition, keyword, or NCT ID</label><div><input id="trial-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Example: diabetes or NCT01234567" required/><button className="btn primary" disabled={busy}>Find study</button></div></form>
    {error&&<p role="alert" className="form-error">{error}</p>}{busy&&<p role="status">Reading the selected study and preparing an answer…</p>}
    {results.length>0&&<section aria-label="Study search results">{results.map(t=><article className="explainer-result" key={t.nctId}><h2>{t.title}</h2><p>{t.nctId} · {t.status}</p><button className="btn secondary" disabled={busy} onClick={()=>select(t.nctId)}>Explain this study</button></article>)}</section>}
    {!trial&&!busy&&<p>Select a real study to start. Fictional demo trials are not used by this explainer.</p>}
    {trial&&<><section className="explainer-record"><h2>{trial.title}</h2><p>{trial.nctId} · {trial.status}</p><a href={trial.studyUrl} target="_blank" rel="noopener noreferrer">Official ClinicalTrials.gov record</a><p>Retrieved {new Date(trial.retrievedAt).toLocaleString()}</p></section>
    <section><h2>Ask about this study</h2><p>English is supported. Other languages and automatic translation are not available in this demo.</p><label>Answer language<select value={language} onChange={e=>{setLanguage(e.target.value);setAnswer(null);generation.current++;setBusy(false);}}><option value="en">English</option><option value="unsupported">Other language, unavailable</option></select></label><p>AI reads the selected official trial record to answer your question. Your question and the public record are sent to AI; profiles are not attached. Do not enter real medical records. Verify AI wording against the cited original excerpts.</p><div className="explainer-samples">{sampleQuestions.map(q=><button key={q} className="btn secondary" disabled={busy} onClick={()=>ask(q)}>{q}</button>)}</div><form onSubmit={e=>{e.preventDefault();ask();}}><label htmlFor="trial-question">Your question</label><textarea id="trial-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={2000} required/><button className="btn primary" disabled={busy}>Ask question</button></form></section>
    {answer&&<section className="explainer-answer" ref={answerRef} tabIndex={-1} aria-label="Study answer"><h2>{answer.question}</h2><p className="eyebrow">{answer.method}</p><p>{answer.answer}</p>{answer.simplifications?.map(x=><p key={x.id}>{x.text} <a href={'#source-'+x.id}>[{x.id}]</a></p>)}{answer.claims?.map((x,i)=><p key={i}>{x.text} {x.source_ids.map(id=><a key={id} href={'#source-'+id}>[{id}] </a>)}</p>)}{answer.general.map((g,i)=><p key={i}>{g}</p>)}<h3>Where this answer came from</h3>{answer.citations.length?answer.citations.map(s=><article id={'source-'+s.id} key={s.id}><b>[{s.id}] {s.label}</b><small>{s.path}</small><blockquote>{s.quote}</blockquote><a href={s.url} target="_blank" rel="noopener noreferrer">Read the official trial record</a></article>):<p>No supporting excerpt was identified. No study-specific facts were generated.</p>}<p>{answer.guidance}</p></section>}</>}
    </main></div>;
}
