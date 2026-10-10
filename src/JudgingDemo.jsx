import React, {useState} from 'react';
import snapshots from '../backend/app/data/trial_snapshots.json';
import {api} from './services/api';
import {matchBottlenecks, updateWorkflow, workflowStages} from './services/demoWorkflow';
import './judging-demo.css';

const studies = snapshots.records;
const storageKey = 'vitra-judging-workflow-v1';
function readWorkflow() {
  try {const value = JSON.parse(localStorage.getItem(storageKey) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {};}
  catch {return {};}
}

export default function JudgingDemo({Sidebar}) {
  const [query,setQuery] = useState(''), [selected,setSelected] = useState(null), [run,setRun] = useState(null);
  const [profileIndex,setProfileIndex] = useState(0), [section,setSection] = useState('match');
  const [workflow,setWorkflow] = useState(readWorkflow), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const [question,setQuestion] = useState('What is this study trying to find out?'), [answer,setAnswer] = useState(null);
  const filtered = studies.filter(s => JSON.stringify(s.protocolSection).toLowerCase().includes(query.toLowerCase()));
  const profile = run?.profiles[profileIndex], match = run?.matches[profileIndex];
  const nctId = selected?.protocolSection.identificationModule.nctId;
  const workflowKey = `${nctId}:${profile?.profile_id}`;
  async function evaluate() {
    setBusy(true); setError(''); setAnswer(null); setRun(null);
    try {setRun(await api.demoEvaluate(nctId)); setProfileIndex(0);}
    catch(e) {setError(e.message);} finally {setBusy(false);}
  }
  async function explain() {
    setBusy(true); setError(''); setAnswer(null);
    try {
      setAnswer(await api.demoExplainTrial(nctId, question));
    } catch(e) {setError(e.message);} finally {setBusy(false);}
  }
  function changeStage(stage) {
    try {const next=updateWorkflow(workflow,nctId,profile.profile_id,stage);localStorage.setItem(storageKey,JSON.stringify(next));setWorkflow(next);setError('');}
    catch {setError('Workflow could not be saved. Browser storage may be unavailable.');}
  }
  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main judging-demo">
    <div className="page-head"><div><span className="eyebrow">Deterministic judging workspace</span><h1>End-to-end trial demo</h1><p>Real public study snapshots, fictional patients, computed rule results.</p></div></div>
    <div className="notice"><span><b>Offline demo.</b> Cached ClinicalTrials.gov records retrieved {snapshots.retrieved_at}. Patients are fictional, evaluated on 2026-10-10. No external API, LLM, Firebase sign-in, patient contact, or eligibility decision is used in this workflow. The local Python backend is required.</span></div>
    <label htmlFor="demo-search">1. Search cached real trial records</label><input id="demo-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Diabetes, asthma, or NCT ID"/>
    <div className="demo-study-list">{filtered.map(record=><button key={record.protocolSection.identificationModule.nctId} className="btn secondary" disabled={busy} onClick={()=>{setSelected(record);setRun(null);setAnswer(null);setError('');setSection('match');}}>{record.protocolSection.identificationModule.nctId} · {record.protocolSection.identificationModule.briefTitle}</button>)}</div>
    {!filtered.length&&<p>No bundled studies match. Clear the search to see all three.</p>}
    {selected&&<section><h2>{selected.protocolSection.identificationModule.briefTitle}</h2><p>{nctId} · {selected.protocolSection.statusModule.overallStatus} · Cached snapshot</p><a href={`https://clinicaltrials.gov/study/${nctId}`} target="_blank" rel="noreferrer">Official trial record</a>
      <details open><summary>2. Original eligibility criteria</summary><pre>{selected.protocolSection.eligibilityModule.eligibilityCriteria}</pre><p>Official age metadata: {selected.protocolSection.eligibilityModule.minimumAge || 'Not provided'} to {selected.protocolSection.eligibilityModule.maximumAge || 'Not provided'}. Supported year bounds are included as separate rules.</p></details>
      <button className="btn primary" disabled={busy} onClick={evaluate}>{busy?'Working…':'3. Parse criteria and evaluate synthetic patients'}</button>
    </section>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {run&&<>
      <details><summary>Structured criteria ({run.parsed.criteria.length})</summary>{run.parsed.criteria.map((c,i)=><article key={i}><b>{c.section} · {c.category} · {c.needs_manual_review?'Manual review required':'Supported rule'}</b><p>{c.original_text}</p></article>)}<small>Source fingerprint: {run.parsed.source_hash}</small></details>
      <label htmlFor="demo-profile">4. Fictional patient</label><select id="demo-profile" value={profileIndex} onChange={e=>setProfileIndex(Number(e.target.value))}>{run.profiles.map((p,i)=><option key={p.profile_id} value={i}>{p.profile_id} · Age {p.age ?? 'Unknown'}</option>)}</select>
      <p>{profile.profile_id} · Conditions: {profile.conditions.map(c=>c.label).join(', ') || 'Not documented'} · No completeness is assumed.</p>
      <nav className="demo-tabs" aria-label="Demo workflow sections">{[['match','5–6. Matching evidence'],['bottlenecks','7. Recruitment Bottleneck Intelligence'],['explanation','8. Trial explanation'],['workflow','9. Workflow status']].map(([id,label])=><button className="btn secondary" key={id} aria-pressed={section===id} onClick={()=>setSection(id)}>{label}</button>)}</nav>
      {section==='match'&&<section><h2>{match.outcome}</h2><p>MET {match.counts.MET} · NOT MET {match.counts.NOT_MET} · UNKNOWN {match.counts.UNKNOWN}</p><p>{match.disclaimer}</p>{match.criteria.map(c=><article key={c.criterion_id}><h3>{c.status.replace('_',' ')} · {c.original_text}</h3><p>{c.profile_evidence}</p><p>{c.explanation}</p><details><summary>Source evidence provenance</summary><pre>{JSON.stringify(c.provenance,null,2)}</pre></details></article>)}</section>}
      {section==='bottlenecks'&&<section><h2>Recruitment Bottleneck Intelligence</h2><p>Computed from the same {run.matches.length} fictional profiles and criterion results. UNKNOWN is separate from a conflict.</p><div className="table-wrap"><table><thead><tr><th>Criterion</th><th>MET</th><th>NOT MET</th><th>UNKNOWN</th><th>Denominator</th></tr></thead><tbody>{matchBottlenecks(run.matches).map(c=><tr key={c.id}><td>{c.text}</td><td>{c.MET}</td><td>{c.NOT_MET}</td><td>{c.UNKNOWN}</td><td>{c.denominator}</td></tr>)}</tbody></table></div></section>}
      {section==='explanation'&&<section><h2>Patient-friendly study explanation</h2><p>Deterministic fallback displays original study wording with citations. The AI tab can simplify it in live mode.</p><label htmlFor="demo-question">Question about this study</label><input id="demo-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={2000}/><button className="btn primary" onClick={explain} disabled={busy||!question.trim()}>Explain selected study</button>{answer&&<article><p>{answer.answer}</p>{answer.claims.map((c,i)=><p key={i}>{c.text} [{c.source_ids.join(', ')}]</p>)}{answer.citations.map(c=><details key={c.id}><summary>{c.id} · {c.label}</summary><blockquote>{c.quote}</blockquote><small>{c.path}</small></details>)}</article>}</section>}
      {section==='workflow'&&<section><h2>Synthetic recruitment workflow</h2><p>Local review status only. Nothing is sent to a researcher or participant; “Review Complete” does not mean medically eligible.</p><label htmlFor="demo-stage">Candidate review status</label><select id="demo-stage" value={workflow[workflowKey]?.stage || 'Needs Review'} onChange={e=>changeStage(e.target.value)}>{workflowStages.map(stage=><option key={stage}>{stage}</option>)}</select><ol>{(workflow[workflowKey]?.events || []).map((event,i)=><li key={i}>{event.stage} · {event.at}</li>)}</ol><button className="btn secondary" onClick={()=>{try {localStorage.removeItem(storageKey);setWorkflow({});}catch {setError('Browser storage unavailable');}}}>Reset judging workflow</button></section>}
    </>}
  </main></div>;
}
