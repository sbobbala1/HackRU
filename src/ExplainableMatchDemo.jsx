import React, { useEffect, useMemo, useState } from 'react';
import { getClinicalTrial } from './services/clinicalTrials';
import { api } from './services/api';

const STUDIES = ['NCT05564039', 'NCT05025787', 'NCT04791371'];
const patients = [
  {profile_id:'SYN-001',age:56,conditions:['Type 2 diabetes'],conditions_complete:true,medications:[{name:'Dulaglutide',status:'current',start_date:'2025-08-01'}],medications_complete:true,labs:[{name:'HbA1c',value:8.1,unit:'%',date:'2026-08-10'},{name:'BMI',value:29,unit:'kg/m2',date:'2026-08-10'}],facts:{}},
  {profile_id:'SYN-002',age:44,conditions:['Type 1 diabetes'],conditions_complete:true,medications:[{name:'Insulin',status:'current'}],medications_complete:true,labs:[{name:'HbA1c',value:8.2,unit:'%',date:'2026-09-01'}],facts:{}},
  {profile_id:'SYN-003',age:null,conditions:null,conditions_complete:false,medications:null,medications_complete:false,labs:null,facts:{}},
  {profile_id:'SYN-004',age:17,conditions:['Type 2 diabetes'],conditions_complete:true,medications:['Dulaglutide'],medications_complete:true,labs:[{name:'HbA1c',value:8.0,unit:'%',date:'2026-09-01'}],facts:{}},
  {profile_id:'SYN-005',age:72,conditions:['Type 2 diabetes'],conditions_complete:true,medications:[{name:'Dulaglutide',status:'current',start_date:'2026-06-01'}],medications_complete:true,labs:[{name:'HbA1c',value:9.8,unit:'%',date:'2026-09-01'}],facts:{}},
  {profile_id:'SYN-006',age:52,conditions:['Type 2 diabetes','No type 2 diabetes'],conditions_complete:true,medications:['Dulaglutide'],medications_complete:true,labs:[{name:'HbA1c',value:7.4,unit:'%',date:'2026-08-15'}],facts:{}},
  {profile_id:'SYN-007',age:49,conditions:['Type 2 diabetes'],conditions_complete:true,medications:[],medications_complete:true,labs:[{name:'HbA1c',value:7.0,unit:'%',date:'2026-09-01'}],facts:{}},
  {profile_id:'SYN-008',age:39,conditions:['Knee osteoarthritis'],conditions_complete:true,medications:[{name:'Prednisone',status:'current'}],medications_complete:true,labs:[{name:'BMI',value:42,unit:'kg/m2',date:'2026-09-01'}],facts:{}},
  {profile_id:'SYN-009',age:61,conditions:['Type 2 diabetes'],conditions_complete:true,medications:[{name:'Dulaglutide',status:'current',start_date:'2025-11-15'}],medications_complete:true,labs:[{name:'HbA1c',value:9.5,unit:'%',date:'2026-09-15'}],facts:{}},
  {profile_id:'SYN-010',age:58,conditions:['Type 2 diabetes'],conditions_complete:false,medications:[{name:'Dulaglutide',status:'current',start_date:'2025-12-01'}],medications_complete:false,labs:[],facts:{}},
  {profile_id:'SYN-011',age:80,conditions:['Knee osteoarthritis'],conditions_complete:true,medications:[],medications_complete:true,labs:[{name:'BMI',value:30,unit:'kg/m2',date:'2026-09-01'}],facts:{}},
  {profile_id:'SYN-012',age:55,conditions:['Asthma'],conditions_complete:true,medications:[{name:'Corticosteroid',status:'past',end_date:'2026-01-01'}],medications_complete:true,labs:[],facts:{}},
];

const researcherNavigation = [
  ['Overview', '/researcher/dashboard'],
  ['My trials', '/researcher/trials'],
  ['Create trial', '/researcher/trials/new'],
  ['Eligibility parser', '/researcher/parser'],
  ['Potential matches', '/researcher/trials/pm-101/matches'],
  ['Recruitment analytics', '/researcher/analytics'],
  ['Profile & settings', '/researcher/settings'],
];

function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function ResearcherSidebar() {
  const currentPath = window.location.pathname;
  return <aside className="side">
    <div className="side-top"><a className="brand" onClick={() => navigate('/')}>Vitra</a><span className="side-product">TRIAL DISCOVERY</span></div>
    <div className="workspace-switch"><span className="workspace-dot">R</span><div><small>Synthetic demo workspace</small><b>Researcher</b></div></div>
    <nav className="side-nav" aria-label="Researcher workspace navigation">
      <div className="role-label">RESEARCHER WORKSPACE</div>
      {researcherNavigation.map(([label, path]) => <button key={path} className={currentPath === path ? 'active' : ''} onClick={() => navigate(path)}><span className="side-nav-mark"/>{label}</button>)}
    </nav>
    <div className="side-bottom">Synthetic demo data only</div>
  </aside>
}

export default function ExplainableMatchDemo(){
  const [studies,setStudies]=useState([]),[studyId,setStudyId]=useState(STUDIES[0]),[results,setResults]=useState([]),[selected,setSelected]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  useEffect(()=>{let live=true;Promise.all(STUDIES.map(id=>getClinicalTrial(id))).then(rows=>{if(live){setStudies(rows);setError('')}}).catch(e=>{if(live)setError(`Unable to load official ClinicalTrials.gov records: ${e.message}`)});return()=>{live=false}},[]);
  const study=useMemo(()=>studies.find(s=>s.nctId===studyId),[studies,studyId]);
  async function run(){if(!study?.eligibility||study.eligibility==='Not provided in the source'){setError('This source record has no eligibility text to compare.');return}setLoading(true);setError('');setResults([]);setSelected(null);try{let criteria=study.eligibility;if(!/\b(age|aged)\b/i.test(criteria)){const min=study.minAge?.match(/\d+/)?.[0],max=study.maxAge?.match(/\d+/)?.[0];if(min||max){criteria+=`\nInclusion Criteria:\n${min&&max?`Age ${min} to ${max} years.`:min?`Age ${min} years or older.`:`Age ${max} years or younger.`}`}}const rows=await api.rankEligibility(study.nctId,study.studyUrl,criteria,patients);setResults(rows);setSelected(rows[0]?.profile_id||null)}catch(e){setError(`${e.message} Confirm the Vitra API is running.`)}finally{setLoading(false)}}
  const active=results.find(x=>x.profile_id===selected);
  return <div className="portal"><ResearcherSidebar/>
    <main className="portal-main"><div className="page-head"><div><span className="eyebrow">Researcher workspace · deterministic rules engine</span><h1>Explainable trial matching</h1><p>Compare 12 synthetic profiles against three real ClinicalTrials.gov records. Each criterion stays visible as MET, NOT MET, or UNKNOWN.</p></div></div>
      <div className="notice"><span><b>Review support only:</b> ranking is an ordinal prioritization heuristic, not a probability of eligibility. No candidate is declared eligible for enrollment.</span></div>
      <section className="match-demo-controls"><label>Official study record<select value={studyId} onChange={e=>setStudyId(e.target.value)}>{STUDIES.map(id=><option key={id} value={id}>{id}{studies.find(s=>s.nctId===id)?` · ${studies.find(s=>s.nctId===id).title}`:''}</option>)}</select></label><button className="btn" onClick={run} disabled={loading||!study}>{loading?'Evaluating criteria…':'Compare all 12 synthetic profiles'}</button>{study&&<p className="source-link">Source: <a href={study.studyUrl} target="_blank" rel="noreferrer">ClinicalTrials.gov · {study.nctId} ↗</a></p>}</section>
      {error&&<div className="form-error">{error}</div>}
      {results.length>0&&<><section className="match-demo-layout"><div className="match-candidates"><h2>Prioritization order</h2><p>Sorted by category, then fewer unknowns and more supported criteria. No percentage score.</p>{results.map(r=><button key={r.profile_id} className={`candidate-card ${selected===r.profile_id?'selected':''}`} onClick={()=>setSelected(r.profile_id)}><span><b>#{r.rank} · {r.profile_id}</b><small>MET {r.counts.MET} · NOT MET {r.counts['NOT MET']} · UNKNOWN {r.counts.UNKNOWN}</small></span><em className={`state-${r.outcome==='Potential Match'?'met':r.outcome==='Criteria Conflict'?'conflict':'unknown'}`}>{r.outcome}</em></button>)}</div>
        {active&&<section className="match-audit"><div className="audit-heading"><div><span className="eyebrow">{active.study_id} · {active.profile_id}</span><h2>{active.outcome}</h2></div><span className="audit-counts">MET {active.counts.MET} · NOT MET {active.counts['NOT MET']} · UNKNOWN {active.counts.UNKNOWN}</span></div><p>{active.prioritization_heuristic}</p><p className="audit-reason">Parser: {active.parser==="llm_structured_output"?"LLM structured assistance; rule states remain deterministic":"Deterministic fallback parser (set OPENAI_API_KEY to enable optional LLM assistance)."}</p>{active.llm_explanation&&<p className="llm-summary"><b>Plain-language summary:</b> {active.llm_explanation}</p>}{active.prioritization_reasons.map(x=><p className="audit-reason">{x}</p>)}{active.missing_information.length>0&&<div className="missing-list"><b>Information needed</b><ul>{active.missing_information.map(x=><li key={x}>{x}</li>)}</ul></div>}<div className="criteria-audit">{active.criteria.map(c=><article key={c.criterion_id}><div className="criterion-title"><span className={`criterion-state ${c.status==='MET'?'is-met':c.status==='NOT MET'?'is-conflict':'is-unknown'}`}>{c.status}</span><b>{c.criterion}</b><small>{c.section} · {c.logic}</small></div><p className="source-criterion"><b>Source:</b> {c.original_text}</p>{c.llm_category_suggestion&&<p><b>LLM parse suggestion:</b> {c.llm_category_suggestion} (review hint only)</p>}<p><b>Patient fields:</b> {c.supporting_patient_fields.join(', ')||'None available'}</p><p><b>Evidence:</b> {c.profile_evidence}</p><p><b>Reason:</b> {c.explanation}</p>{c.missing_information.length>0&&<small>Review needed: {c.missing_information.join('; ')}</small>}</article>)}</div>{active.warnings.map(w=><p className="audit-warning">{w}</p>)}</section>}</section></>}
      <p className="demo-footnote">Patient IDs and all patient attributes are fictional. The study records are real public records. Every unresolved criterion is sent for review instead of being assumed satisfied.</p>
    </main></div>
}
