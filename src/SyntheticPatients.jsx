import React, { useEffect, useState } from 'react';
import { api } from './services/api';
import demoBundles from '../backend/app/data/synthetic_demo.json';
import demoSnapshot from './demo-patient-snapshot.json';
import './synthetic-patients.css';

export default function SyntheticPatients({ Sidebar }) {
  const [records, setRecords] = useState([]), [selected, setSelected] = useState(0);
  const [attested, setAttested] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [criteria, setCriteria] = useState('Inclusion Criteria:\nAge 18 to 75 years.\nDiagnosis of type 2 diabetes.\nHbA1c >= 7.0% within 90 days.');
  const [match, setMatch] = useState(null);
  async function loadDemo() {
    setBusy(true); setError(''); setNotice('');
    try { const data = await api.syntheticDemo(); setRecords(data.profiles.map((p, i) => ({ profile: p, bundle: data.bundles[i] }))); setSelected(0); setMatch(null); }
    catch (e) { setRecords(demoSnapshot.map((profile,i)=>({profile,bundle:demoBundles[i]}))); setSelected(0); setMatch(null); setNotice(`${e.message} Showing a read-only fictional snapshot evaluated on 2026-10-10. Imports and current matching require the updated backend.`); }
    finally { setBusy(false); }
  }
  useEffect(() => { loadDemo(); }, []);
  async function upload(event) {
    const file = event.target.files?.[0]; if (!file) return;
    setError(''); setNotice(''); setBusy(true); setMatch(null);
    try {
      if (!attested) throw new Error('Confirm synthetic-only data before importing');
      if (file.size > 5 * 1024 * 1024) throw new Error('Maximum file size is 5 MB');
      const bundle = JSON.parse(await file.text());
      const profile = await api.syntheticImport(bundle);
      setRecords(old => [...old, { profile, bundle }]); setSelected(records.length);
    } catch (e) { setError(e.message); } finally { setBusy(false); event.target.value = ''; }
  }
  async function compare() {
    setBusy(true); setError(''); setNotice(''); setMatch(null);
    try { const parsed = await api.parseEligibility('SYNTHETIC-DEMO-RULES', criteria); setMatch(await api.syntheticMatch(parsed, records[selected].bundle)); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(demoBundles, null, 2)], {type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'vitra-fictional-demo-bundles.json'; a.click(); URL.revokeObjectURL(url);
  }
  const p = records[selected]?.profile;
  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main synthetic-page">
    <div className="page-head"><div><span className="eyebrow">Doctor workspace</span><h1>Synthetic patients</h1><p>All patients are fictional. These records are not a clinically representative population.</p></div></div>
    <div className="notice"><span><b>Synthetic data only.</b> Do not upload real medical records. Imports are processed in memory, are not saved to Firebase, and disappear when you leave this page. Official screening is required.</span></div>
    <section className="synthetic-import"><h2>Import a Synthea FHIR R4 patient</h2><label><input type="checkbox" checked={attested} onChange={e=>setAttested(e.target.checked)}/> I confirm this file contains fictional, synthetic records only.</label><label>One patient Bundle, JSON, up to 5 MB<input type="file" accept=".json,application/json" disabled={!attested || busy} onChange={upload}/></label><button className="btn secondary" onClick={loadDemo} disabled={busy}>Reload demo patients</button> <button className="btn secondary" onClick={download}>Download fictional examples</button><p>Downloaded examples are an array of three Bundles. Import one Bundle at a time.</p></section>
    {notice && <p role="status" className="notice synthetic-fallback-notice">{notice}</p>}{error && <p role="alert" className="form-error">{error}</p>}{busy && <p role="status">Processing synthetic records…</p>}
    {records.length>0 && <><label>Fictional patient<select value={selected} onChange={e=>{setSelected(Number(e.target.value));setMatch(null);}}>{records.map(({profile}, i)=><option key={i} value={i}>{profile.profile_id} · age {profile.age ?? 'unknown'}</option>)}</select></label>
    <section><h2>{p.profile_id}</h2><p>Age: {p.age ?? 'Unknown'} · Evaluated on {p.as_of} · Lab freshness policy: 90 days maximum</p><details><summary>Age source</summary><pre>{JSON.stringify(p.age_source,null,2)}</pre></details>{p.warnings.map((w,i)=><p key={i}>{w}</p>)}
    {['conditions','medications','procedures','observations'].map(kind=><section key={kind}><h3>{kind[0].toUpperCase()+kind.slice(1)}</h3>{!p[kind].length?<p>Not provided. No absence is inferred.</p>:<div className="table-wrap"><table><thead><tr><th>Evidence</th><th>Date / status</th><th>Validation</th><th>Provenance</th></tr></thead><tbody>{p[kind].map((x,i)=><tr key={i}><td>{x.label}<small>{x.code}</small>{kind==='observations'&&<><p>{x.value ?? 'Unknown'} {x.unit}</p><small>Original: {String(x.original_value ?? 'Unknown')} {x.original_unit} · {x.conversion}</small></>}</td><td>{x.date || 'Not provided'}<small>{x.status}</small></td><td>{x.issue || (kind==='observations'?'Usable for supported rules':'Source record retained')}</td><td><details><summary>View source reference</summary><pre>{JSON.stringify(x,null,2)}</pre></details></td></tr>)}</tbody></table></div>}</section>)}</section>
    <section className="synthetic-import"><h2>Preliminary trial matching</h2><p>These are fictional demonstration criteria, not a real trial. Edit them to test supported rules. Unsupported rules remain UNKNOWN.</p><button className="btn secondary" onClick={()=>{setCriteria(criteria+"\nExclusion Criteria:\nDiagnosis of cancer.");setMatch(null);}}>Add fictional cancer exclusion</button><label>Eligibility criteria<textarea value={criteria} onChange={e=>{setCriteria(e.target.value);setMatch(null);}}/></label><button className="btn primary" onClick={compare} disabled={busy || !criteria.trim()}>Compare selected fictional patient</button>
    {match&&<><h3>{match.outcome}</h3><p>MET {match.counts.MET} · NOT MET {match.counts.NOT_MET} · UNKNOWN {match.counts.UNKNOWN}</p>{match.criteria.map((r,i)=><article className="synthetic-result" key={i}><b>{r.status.replace('_',' ')}: {r.original_text}</b><p>{r.profile_evidence}</p><p>{r.explanation}</p><details><summary>Evidence provenance</summary><pre>{JSON.stringify(r.provenance,null,2)}</pre></details></article>)}<p>{match.disclaimer}</p></>}</section></>}
  </main></div>;
}
