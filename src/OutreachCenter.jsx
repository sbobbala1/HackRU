import React, { useEffect, useMemo, useState } from 'react';
import { getClinicalTrial } from './services/clinicalTrials';
import { patients } from './ExplainableMatchDemo';
import WorkplaceBadge from './WorkplaceBadge';
import { profileName, readActiveRecruitmentCycle, readAiReviewQueue, readScreeningQueue, resetActiveRecruitmentWorkflow, screeningSourceStatus } from './recruitmentWorkflow';
import { clearFinalistSelections, finalistEvent, readFinalistSelections } from './finalistSelections';
import { logActivity } from './activityLog';
import { navigate } from './navigation';
import './outreach-center.css';

const HISTORY_KEY = 'vitra-outreach-history-v1';
const ARCHIVE_KEY = 'vitra-completed-recruitment-cycles-v1';
const COMPLETION_STATUSES = new Set(['Scheduled', 'Sent', 'Simulated sent', 'Delivered', 'Responded', 'Opted out', 'Cancelled']);
const FOLDERS = ['Inbox', 'All outreach', 'Drafts', 'Ready to review', 'Screening follow-up', 'Sent', 'Scheduled', 'Delivered', 'Responded', 'Opted out'];
const CHANNELS = ['Email', 'SMS / text'];
const TEMPLATES = {
  'Screening follow-up': { subject: 'Next step for your study screening', email: row => `Hello ${profileName(row.profile)},\n\nThe study team would like to help with the next screening step for ${row.item.trialTitle} (${row.item.trialId}).\n\nPublic study site: ${row.item.publicSite}\n\nPlease contact the study team to arrange or complete screening. Participation is voluntary and this does not confirm eligibility or enrollment.`, sms: row => `${row.item.trialId}: Please contact the study team about your next screening step at ${row.item.publicSite}. Participation is voluntary.` },
  'Trial participation invitation': { subject: 'Invitation to learn more about a clinical research study', email: row => `Hello ${profileName(row.profile)},\n\nYou are invited to learn more about ${row.item.trialTitle} (${row.item.trialId}) at ${row.item.publicSite}.\n\nThe study team can explain the study and any required screening. Participation is voluntary and this does not confirm eligibility or enrollment.`, sms: row => `${row.item.trialId}: You can learn more about this research study at ${row.item.publicSite}. Contact the study team if interested.` },
};
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; } };
const displayStatus = status => status === 'Simulated sent' ? 'Sent' : status;
const folderMatches = (row, folder) => folder === 'All outreach' || folder === 'Drafts' && row.status === 'Draft created' || folder === 'Screening follow-up' && row.screeningFollowUp && !COMPLETION_STATUSES.has(row.status) || displayStatus(row.status) === folder;
const priority = row => row.screeningFollowUp && !COMPLETION_STATUSES.has(row.status) ? 0 : ({ 'Ready to review': 1, Scheduled: 2, 'Draft created': 3, Sent: 4, 'Simulated sent': 4, Delivered: 5, Responded: 6, 'Opted out': 7 }[row.status] ?? 8);
const draftKey = (channel, template) => `${channel}:${template}`;
const templateBody = (template, row, channel) => channel === 'SMS / text' ? TEMPLATES[template].sms(row) : TEMPLATES[template].email(row);
const downloadArchiveCsv = cycle => {
  const rows = [['Cycle ID', 'Completed at', 'Participant', 'Synthetic ID', 'NCT ID', 'Trial', 'Public site', 'Review outcome', 'Outreach status'], ...cycle.participants.map(item => [cycle.cycleId, cycle.completedAt, item.fictionalParticipantName, item.syntheticParticipantId, item.trialNctId, item.trialTitle, item.publicSite, item.aiFitReviewStatus, item.outreachStatus])];
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `${cycle.cycleId}-summary.csv`; link.click(); URL.revokeObjectURL(link.href);
};

export default function OutreachCenter({ Sidebar }) {
  const [studies, setStudies] = useState([]);
  const [history, setHistory] = useState(() => readJson(HISTORY_KEY, {}));
  const [finalists, setFinalists] = useState(readFinalistSelections);
  const [folder, setFolder] = useState('All outreach');
  const [selected, setSelected] = useState(null);
  const [selectedInbox, setSelectedInbox] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [query, setQuery] = useState('');
  const [replyBody,setReplyBody] = useState('');
  const [trialFilter, setTrialFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [channel, setChannel] = useState('Email');
  const [template, setTemplate] = useState('Screening follow-up');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [completionError, setCompletionError] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archives, setArchives] = useState(() => readJson(ARCHIVE_KEY, []));
  const [bulkNotice, setBulkNotice] = useState('');

  useEffect(() => { const ids = [...new Set(Object.values(finalists).filter(item => item && typeof item.trialId === 'string' && typeof item.profileId === 'string').map(item => item.trialId))]; if (!ids.length) { setStudies([]); return undefined; } let alive = true; Promise.all(ids.map(getClinicalTrial)).then(rows => alive && setStudies(rows)).catch(() => alive && setStudies([])); return () => { alive = false; }; }, [finalists]);
  useEffect(() => { const sync = () => setFinalists(readFinalistSelections()); window.addEventListener(finalistEvent, sync); return () => window.removeEventListener(finalistEvent, sync); }, []);

  const recipients = useMemo(() => Object.values(finalists).filter(item => item && typeof item.trialId === 'string' && typeof item.profileId === 'string').map(item => {
    const profile = patients.find(person => person.profile_id === item.profileId);
    const study = studies.find(record => record.nctId === item.trialId);
    const key = [item.researcherId, item.profileId, item.trialId, item.publicSite].join('::');
    const record = history[key] || {};
    const eligible = profile?.demo_consent && item.availability === 'Available' && item.deterministicOutcome === 'Potential Match' && record.status !== 'Opted out';
    const screeningStatus = screeningSourceStatus(item.trialId, profile);
    const screeningFollowUp = item.outreachDraftType === 'screening-follow-up' && !COMPLETION_STATUSES.has(record.status || item.outreachDraftStatus);
    const defaultTemplate = screeningFollowUp ? 'Screening follow-up' : 'Trial participation invitation';
    return { item, profile, study, key, record, eligible, screeningStatus, screeningFollowUp, status: record.status || (eligible ? (item.outreachDraftStatus || 'Draft created') : 'Draft disabled'), channel: record.channel || 'Email', template: TEMPLATES[record.template] ? record.template : defaultTemplate };
  }).sort((a, b) => priority(a) - priority(b) || a.item.trialId.localeCompare(b.item.trialId) || profileName(a.profile).localeCompare(profileName(b.profile))), [studies, history, finalists]);
  const filtered = recipients.filter(row => folderMatches(row, folder) && (trialFilter === 'all' || row.item.trialId === trialFilter) && (channelFilter === 'all' || row.channel === channelFilter) && (!query.trim() || `${profileName(row.profile)} ${row.item.trialId} ${row.item.trialTitle} ${row.item.publicSite}`.toLowerCase().includes(query.toLowerCase())));
  const inboxItems = useMemo(() => recipients.flatMap(row => (row.record.responses || []).map((reply,index) => ({id: `${row.key}:${index}`, kind:'Recorded demo reply', content:reply.body, row, at:reply.at, unread:false}))), [recipients]);
  const activeInbox = inboxItems.find(item => item.id === selectedInbox) || inboxItems[0];
  const active = recipients.find(row => row.key === selected) || filtered[0] || recipients[0];
  const activeWorkflowCount = recipients.length + Object.keys(readAiReviewQueue()).length + Object.keys(readScreeningQueue()).length;
  const canCompleteCycle = activeWorkflowCount > 0 || Object.keys(history).length > 0;
  const selection = recipients.filter(row => selectedRows.includes(row.key));

  useEffect(() => {
    if (!active) { setSubject(''); setBody(''); return; }
    const nextTemplate = active.template;
    const nextChannel = active.channel;
    const draft = active.record.drafts?.[draftKey(nextChannel, nextTemplate)];
    setTemplate(nextTemplate);
    setChannel(nextChannel);
    setSubject(draft?.subject || TEMPLATES[nextTemplate].subject);
    setBody(draft?.body || templateBody(nextTemplate, active, nextChannel));
    setScheduledFor(active.record.scheduledFor ? active.record.scheduledFor.slice(0, 16) : '');
  }, [active?.key]);
  useEffect(() => {
    if (!active) return;
    const draft = active.record.drafts?.[draftKey(channel, template)];
    setSubject(draft?.subject || TEMPLATES[template].subject);
    setBody(draft?.body || templateBody(template, active, channel));
  }, [channel]);
  function persist(next) { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); setHistory(next); }
  function updateActiveDraft(overrides = {}) {
    if (!active || !active.eligible) return;
    const now = new Date().toISOString();
    const previous = history[active.key] || {};
    persist({ ...history, [active.key]: { ...previous, status: previous.status || 'Draft created', channel, template, updatedAt: now, drafts: { ...(previous.drafts || {}), [draftKey(channel, template)]: { subject, body, template, updatedAt: now } }, ...overrides } });
  }
  function chooseTemplate(nextTemplate) { setTemplate(nextTemplate); const draft = active?.record.drafts?.[draftKey(channel, nextTemplate)]; setSubject(draft?.subject || TEMPLATES[nextTemplate].subject); setBody(draft?.body || templateBody(nextTemplate, active, channel)); }
  function record(status, target = active, {base=history,save=true,forceChannel}={}) {
    if (!target || !target.eligible) return;
    const now = new Date().toISOString();
    const previous = base[target.key] || {};
    const draftSubject = target.key === active?.key && (!forceChannel || channel === forceChannel) ? subject : previous.drafts?.[draftKey(forceChannel || target.channel,target.template)]?.subject || TEMPLATES[target.template].subject;
    const draftBody = target.key === active?.key && (!forceChannel || channel === forceChannel) ? body : previous.drafts?.[draftKey(forceChannel || target.channel,target.template)]?.body || templateBody(target.template, target, forceChannel || target.channel);
    const scheduledAt = status === 'Scheduled' && target.key === active?.key && scheduledFor ? new Date(scheduledFor).toISOString() : status === 'Scheduled' && scheduledFor ? new Date(scheduledFor).toISOString() : previous.scheduledFor;
    const recordChannel = forceChannel || (target.key === active?.key ? channel : target.channel); const recordTemplate = target.key === active?.key ? template : target.template;
    const next = { ...base, [target.key]: { ...previous, status, channel: recordChannel, template: recordTemplate, at: now, scheduledFor: scheduledAt, drafts: { ...(previous.drafts || {}), [draftKey(recordChannel, recordTemplate)]: { subject: draftSubject, body: draftBody, template: recordTemplate, updatedAt: now } }, events: [...(previous.events || []), { status, channel: recordChannel, at: now, scheduledFor: scheduledAt, operator: 'Researcher workspace' }] } };
    if(save) persist(next);
    const changed = previous.status !== status || status === 'Scheduled' && previous.scheduledFor !== scheduledAt;
    if (changed) {
      const labels = { 'Ready to review': ['outreach_ready_to_review', 'Outreach ready to review'], Scheduled: ['outreach_scheduled', 'Outreach scheduled'], Sent: ['outreach_sent', 'Outreach sent'], Delivered: ['outreach_delivered', 'Outreach delivered'], Responded: ['outreach_responded', 'Outreach response recorded'], 'Opted out': ['outreach_opted_out', 'Outreach opt-out recorded'] };
      const [type, title] = labels[status] || ['outreach_updated', 'Outreach updated'];
      logActivity({ type, title, href: '/researcher/outreach', participantId: target.item.profileId, trialId: target.item.trialId, publicSite: target.item.publicSite, researcherId: target.item.researcherId, timestamp: status === 'Scheduled' && scheduledAt ? scheduledAt : now });
    }
    return next;
  }
  function recordReply(){if(!active?.eligible||!replyBody.trim())return;const at=new Date().toISOString();persist({...history,[active.key]:{...active.record,status:'Responded',responses:[...(active.record.responses||[]),{body:replyBody.trim(),at}]}});setReplyBody('');}
  function toggleSelection(key) { setSelectedRows(rows => rows.includes(key) ? rows.filter(item => item !== key) : [...rows, key]); }
  function applyBulk(status,forceChannel){const valid=selection.filter(row=>row.eligible);if(status==='Scheduled'&&!scheduledFor){setBulkNotice('Choose a send date and time first.');return}let next=history;for(const row of valid) next=record(status,row,{base:next,save:false,forceChannel});persist(next);setSelectedRows([]);setBulkNotice(valid.length?`${valid.length} ${forceChannel==='Email'?'emails':'records'} ${status==='Simulated sent'?'sent in demo mode':status.toLowerCase()}. No real messages were sent.`:'Select available, consented recipients first.');}
  function applyBulkTemplate() { const valid = selection.filter(row => row.eligible); const now = new Date().toISOString(); const next = { ...history }; valid.forEach(row => { const previous = next[row.key] || {}; next[row.key] = { ...previous, status: previous.status || 'Draft created', channel: row.channel, template, drafts: { ...(previous.drafts || {}), [draftKey(row.channel, template)]: { subject: TEMPLATES[template].subject, body: templateBody(template, row, row.channel), template, updatedAt: now } }, updatedAt: now }; }); persist(next); setBulkNotice(valid.length ? `${template} applied to ${valid.length} draft${valid.length === 1 ? '' : 's'}.` : 'Select at least one eligible recipient first.'); }
  function completeCycle() {
    const completedAt = new Date().toISOString();
    const activeCycle = readActiveRecruitmentCycle();
    const sourceTrials = [...new Map(recipients.map(row => [row.item.trialId, { nctId: row.item.trialId, title: row.item.trialTitle, publicSite: row.item.publicSite, sourceUrl: row.study?.studyUrl || `https://clinicaltrials.gov/study/${row.item.trialId}`, sourceRetrievedAt: row.item.sourceRetrievedAt }])).values()];
    const channelCounts = recipients.reduce((all, row) => ({ ...all, [row.record.channel || row.channel]: (all[row.record.channel || row.channel] || 0) + 1 }), {});
    const cycle = { cycleId: activeCycle.id, researcherId: recipients[0]?.item.researcherId || 'demo-researcher', completedAt, workplaceContext: readJson('vitra-researcher-workplace-v1', null), trials: sourceTrials, participants: recipients.map(row => ({ syntheticParticipantId: row.item.profileId, fictionalParticipantName: profileName(row.profile), trialNctId: row.item.trialId, trialTitle: row.item.trialTitle, publicSite: row.item.publicSite, screeningWorkflowStatus: row.screeningStatus, aiFitReviewStatus: row.item.deterministicOutcome, deterministicEvidenceSummary: { met: row.item.counts?.MET ?? 0, notMet: row.item.counts?.['NOT MET'] ?? 0, unknown: row.item.counts?.UNKNOWN ?? 0, needsClinicalReview: row.item.counts?.['NEEDS REVIEW'] ?? 0 }, finalMatchAssignedAt: row.item.selectedAt, outreachStatus: displayStatus(row.status), outreachHistory: row.record.events || [] })), summary: { screeningQueueCount: Object.keys(readScreeningQueue()).length, aiFitReviewQueueCount: Object.keys(readAiReviewQueue()).length, finalMatchesCount: recipients.length, outreachDraftCount: Object.keys(history).length, sentCount: recipients.filter(row => displayStatus(row.status) === 'Sent').length, scheduledCount: recipients.filter(row => row.status === 'Scheduled').length, responseCount: recipients.filter(row => row.status === 'Responded').length, messagesByChannel: channelCounts } };
    try {
      const nextArchives = [cycle, ...archives];
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(nextArchives));
      setArchives(nextArchives);
    } catch {
      setCompletionError('The cycle archive could not be saved. Your active workflow is unchanged; free some browser storage and try again.');
      return;
    }
    logActivity({ type: 'recruitment_cycle_completed', title: 'Recruitment cycle completed', href: '/researcher/outreach', researcherId: cycle.researcherId, timestamp: completedAt });
    localStorage.removeItem(HISTORY_KEY); clearFinalistSelections(); resetActiveRecruitmentWorkflow(); sessionStorage.setItem('vitra-cycle-reset-notice', 'Outreach cycle completed. Your active recruitment workspace has been reset.'); setConfirmReset(false); navigate('/researcher/screening');
  }
  const summary = { finalists: recipients.length, trials: [...new Set(recipients.map(row => row.item.trialId))], sites: [...new Set(recipients.map(row => row.item.publicSite))], statuses: recipients.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }), {}) };

  const cycleControls = <>
    <section className="cycle-completion-card"><button className="btn secondary" disabled={!canCompleteCycle} onClick={() => { setCompletionError(''); setConfirmReset(true); }}>Complete outreach cycle</button>{!canCompleteCycle && <small>No active outreach cycle to complete.</small>}</section>
    {confirmReset && <div className="cycle-modal" role="dialog" aria-modal="true" aria-labelledby="cycle-modal-title"><section><span className="eyebrow">Confirm cycle completion</span><h2 id="cycle-modal-title">Complete this outreach cycle?</h2><p>Completing this cycle archives the current workflow and clears active recruitment records so you can begin a new cycle.</p>{completionError && <div className="form-error" role="alert">{completionError}</div>}<dl><div><dt>Participants in active workflow</dt><dd>{activeWorkflowCount}</dd></div><div><dt>AI Fit Review records</dt><dd>{Object.keys(readAiReviewQueue()).length}</dd></div><div><dt>Final Matches</dt><dd>{summary.finalists}</dd></div><div><dt>Outreach drafts</dt><dd>{Object.keys(history).length}</dd></div><div><dt>Trials / NCT IDs</dt><dd>{summary.trials.join(', ') || 'None'}</dd></div><div><dt>Public study sites</dt><dd>{summary.sites.join(' Ã‚Â· ') || 'None'}</dd></div><div><dt>Current statuses</dt><dd>{Object.entries(summary.statuses).map(([status, count]) => `${displayStatus(status)}: ${count}`).join(' Ã‚Â· ') || 'None'}</dd></div><div><dt>Completion time</dt><dd>{new Date().toLocaleString()}</dd></div></dl><div className="outreach-actions"><button className="btn" onClick={completeCycle}>Complete and reset cycle</button><button className="btn secondary" onClick={() => setConfirmReset(false)}>Cancel</button></div></section></div>}
    {archiveOpen && <div className="cycle-modal" role="dialog" aria-modal="true" aria-labelledby="archive-modal-title"><section className="archive-modal"><span className="eyebrow">Read-only archive</span><h2 id="archive-modal-title">Completed cycles</h2>{archives.length ? archives.map(cycle => <article key={cycle.cycleId}><b>{cycle.cycleId}</b><small>{new Date(cycle.completedAt).toLocaleString()} Ã‚Â· {cycle.researcherId}</small><p><small>{cycle.participants?.length || 0} participants Ã‚Â· {cycle.trials?.map(trial => trial.nctId).join(', ') || 'No trial records'} Ã‚Â· {Object.entries(cycle.summary?.messagesByChannel || {}).map(([channelName,count]) => `${channelName}: ${count}`).join(' Ã‚Â· ') || 'No outreach messages'}</small></p><button className="btn secondary" onClick={() => downloadArchiveCsv(cycle)}>Download CSV</button><button className="btn secondary" onClick={() => window.print()}>Print / save PDF</button>{(cycle.participants || []).map(item => <p key={`${cycle.cycleId}-${item.syntheticParticipantId}-${item.trialNctId}`}><b>{item.fictionalParticipantName}</b> Ã‚Â· {item.syntheticParticipantId} Ã‚Â· {item.trialNctId} Ã‚Â· {item.publicSite}<br/><small>{item.aiFitReviewStatus} Ã‚Â· {item.outreachStatus} Ã‚Â· MET {item.deterministicEvidenceSummary?.met ?? 0}, NOT MET {item.deterministicEvidenceSummary?.notMet ?? 0}, UNKNOWN {item.deterministicEvidenceSummary?.unknown ?? 0}</small></p>)}</article>) : <p>No completed recruitment cycles yet.</p>}<button className="btn secondary" onClick={() => setArchiveOpen(false)}>Close archive</button></section></div>}
  </>;

  if (folder === 'Inbox') return <div className="portal"><Sidebar role="researcher"/><main className="portal-main outreach-center">
    <div className="page-head"><div><span className="eyebrow">Final Matches</span><h1>Outreach Center</h1><p>Synthetic demo only. Sending records a simulation; no real emails or texts are delivered.</p></div><div className="outreach-header"><WorkplaceBadge/><button className="btn secondary" onClick={() => setArchiveOpen(true)}>Completed cycles ({archives.length})</button></div></div>
    <section className="outreach-layout"><aside className="outreach-folders"><button className="compose-simulated" disabled={!active?.eligible} onClick={() => { setFolder('All outreach'); setSelected(active?.key || null); updateActiveDraft(); }}>Ã¯Â¼â€¹ Compose message</button>{FOLDERS.map(name => <button key={name} className={folder === name ? 'active' : ''} onClick={() => setFolder(name)}>{name}<b>{name === 'Inbox' ? inboxItems.length : recipients.filter(row => folderMatches(row, name)).length}</b></button>)}<button onClick={() => setArchiveOpen(true)}>Archived cycles <b>{archives.length}</b></button></aside>
      <section className="outreach-list inbox-list"><div className="outreach-list-head"><div><h2>Inbox</h2><small>Messages, study-site alerts, booking questions, and cancellations</small></div></div>{inboxItems.map(item => <article key={item.id} className={`outreach-recipient ${activeInbox?.id === item.id ? 'selected' : ''}`}><button onClick={() => setSelectedInbox(item.id)}><span className="needs-action">{item.kind}</span><b>{profileName(item.row.profile)}</b><small>{item.row.profile?.profile_id} Ã‚Â· {item.row.item.trialId} Ã‚Â· {item.row.item.publicSite}</small><small>{item.content}</small><span className="recipient-meta"><em>{item.unread ? 'New' : 'Read'}</em><time>{new Date(item.at).toLocaleString()}</time></span></button></article>)}{!inboxItems.length && <div className="empty">No recorded replies yet. Record a demo reply for a recipient to see it here.</div>}</section>
      <section className="outreach-composer inbox-reader">{activeInbox ? <><span className="eyebrow">{activeInbox.kind}</span><h2>{profileName(activeInbox.row.profile)}</h2><p><b>{activeInbox.row.item.trialId}</b> Ã‚Â· {activeInbox.row.item.trialTitle}</p><div className="inbox-message"><p>{activeInbox.content}</p><small>{new Date(activeInbox.at).toLocaleString()} Ã‚Â· {activeInbox.row.item.publicSite}</small></div><div className="outreach-facts"><span><b>Public site</b>{activeInbox.row.item.publicSite}</span><span><b>Outreach status</b>{displayStatus(activeInbox.row.status)}</span><span><b>Category</b>{activeInbox.kind}</span><span><b>Participant</b>{activeInbox.row.profile?.profile_id}</span></div><div className="outreach-actions"><button className="btn" onClick={() => { setFolder('All outreach'); setSelected(activeInbox.row.key); }}>Reply</button><button className="btn secondary" onClick={() => setSelectedInbox(null)}>Close message</button></div></> : <div className="empty">Select an inbox message to view it.</div>}</section>
    </section>{cycleControls}</main></div>;

  return <div className="portal"><Sidebar role="researcher"/><main className="portal-main outreach-center">
    <div className="page-head"><div><span className="eyebrow">Final Matches</span><h1>Outreach Center</h1><p>Synthetic demo only. Sending records a simulation; no real emails or texts are delivered.</p></div><div className="outreach-header"><WorkplaceBadge/><button className="btn secondary" onClick={() => setArchiveOpen(true)}>Completed cycles ({archives.length})</button></div></div>
    <section className="outreach-layout"><aside className="outreach-folders"><button className="compose-simulated" disabled={!active?.eligible} onClick={() => { setFolder('All outreach'); setSelected(active?.key || null); updateActiveDraft(); }}>Ã¯Â¼â€¹ Compose message</button>{FOLDERS.map(name => <button key={name} className={folder === name ? 'active' : ''} onClick={() => setFolder(name)}>{name}<b>{name === 'Inbox' ? inboxItems.length : recipients.filter(row => folderMatches(row, name)).length}</b></button>)}<button onClick={() => setArchiveOpen(true)}>Archived cycles <b>{archives.length}</b></button></aside>
      <section className="outreach-list"><div className="outreach-list-head"><div><h2>Final Match recipients</h2></div><input aria-label="Search outreach" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people, NCT ID, siteÃ¢â‚¬Â¦"/></div><div className="outreach-filters"><select value={trialFilter} onChange={event => setTrialFilter(event.target.value)}><option value="all">All trials</option>{[...new Set(recipients.map(row => row.item.trialId))].map(id => <option key={id}>{id}</option>)}</select><select value={channelFilter} onChange={event => setChannelFilter(event.target.value)}><option value="all">All channels</option>{CHANNELS.map(item => <option key={item}>{item}</option>)}</select><span>{filtered.length} shown</span></div>{selection.length > 0 && <div className="bulk-actions"><b>{selection.length} selected</b><button onClick={()=>applyBulk('Simulated sent','Email')}>Send email</button><button onClick={() => applyBulk('Ready to review')}>Mark ready</button><button onClick={() => applyBulk('Scheduled')}>Schedule</button><button onClick={applyBulkTemplate}>Apply template</button></div>}{bulkNotice && <div className="success bulk-notice">{bulkNotice}</div>}{filtered.map(row => <article key={row.key} className={`outreach-recipient ${active?.key === row.key ? 'selected' : ''}`}><label className="recipient-check"><input aria-label={`Select ${profileName(row.profile)} for outreach`} type="checkbox" checked={selectedRows.includes(row.key)} onChange={() => toggleSelection(row.key)}/><span/></label><button onClick={() => setSelected(row.key)}><span className="needs-action">{row.screeningFollowUp && !COMPLETION_STATUSES.has(row.status) ? 'Needs screening follow-up' : displayStatus(row.status)}</span><b>{profileName(row.profile)}</b><small>{row.profile?.profile_id} Ã‚Â· {row.item.trialId} Ã‚Â· {row.item.publicSite}</small><small>{row.item.trialTitle}</small><span className="recipient-meta"><em>{row.channel}</em><time>{row.record.scheduledFor ? new Date(row.record.scheduledFor).toLocaleString() : row.record.updatedAt || row.item.selectedAt ? new Date(row.record.updatedAt || row.item.selectedAt).toLocaleDateString() : 'New draft'}</time></span></button></article>)}{!filtered.length && <div className="empty">No records in this folder. Assign participants from Final Matches, or choose All outreach to review other statuses.</div>}</section>
      <section className="outreach-composer">{active ? <><span className="eyebrow">Outreach message</span><h2>{profileName(active.profile)}</h2><p><b>{active.item.trialId}</b> Ã‚Â· {active.study?.title || active.item.trialTitle}</p><div className="outreach-facts"><span><b>Public site</b>{active.item.publicSite}</span><span><b>Consent / availability</b>{active.profile?.demo_consent ? 'Consent recorded' : 'No consent'} Ã‚Â· {active.item.availability}</span><span><b>Screening workflow</b>{active.screeningStatus}</span><span><b>Fit review</b>Potential Match</span></div>{!active.eligible && <div className="form-error">Draft disabled: consent, availability, review outcome, or opt-out status no longer permits outreach.</div>}<label>Channel<select value={channel} onChange={event => setChannel(event.target.value)} disabled={!active.eligible}>{CHANNELS.map(item => <option key={item}>{item}</option>)}</select></label><label>Message template<select value={template} onChange={event => chooseTemplate(event.target.value)} disabled={!active.eligible}>{Object.keys(TEMPLATES).map(item => <option key={item}>{item}</option>)}</select></label><p className="channel-note">{channel === 'SMS / text' ? `${body.length} characters` : channel === 'Phone-call script' ? 'Call script' : channel}</p><label>Subject<input value={subject} onChange={event => setSubject(event.target.value)} disabled={!active.eligible}/></label><label>Message<textarea value={body} onChange={event => setBody(event.target.value)} disabled={!active.eligible}/></label><label>Send date & time<input type="datetime-local" value={scheduledFor} onChange={event => setScheduledFor(event.target.value)} disabled={!active.eligible}/></label><div className="outreach-actions"><button className="btn secondary" disabled={!active.eligible} onClick={updateActiveDraft}>Save draft</button><button className="btn" disabled={!active.eligible} onClick={() => record('Simulated sent')}>Send (demo)</button><button className="btn secondary" disabled={!active.eligible || !scheduledFor} onClick={() => record('Scheduled')}>Schedule</button><button className="btn secondary" disabled={!active.eligible} onClick={() => record('Opted out')}>Record opt-out</button></div>{active.record.events?.length > 0 && <div className="outreach-history"><h3>Outreach history</h3>{active.record.events.map((event, index) => <p key={`${event.at}-${index}`}><b>{displayStatus(event.status)}</b> Ã‚Â· {event.channel} Ã‚Â· {event.scheduledFor ? `Scheduled for ${new Date(event.scheduledFor).toLocaleString()} Ã‚Â· ` : ''}{new Date(event.at).toLocaleString()} Ã‚Â· {event.operator}</p>)}</div>}<label>Demo reply<textarea value={replyBody} onChange={event=>setReplyBody(event.target.value)} disabled={!active.eligible}/></label><button className="btn secondary" disabled={!active.eligible||!replyBody.trim()} onClick={recordReply}>Record demo reply</button><div className="channel-drafts"><b>Saved channel drafts</b>{Object.entries(active.record.drafts || {}).length ? Object.entries(active.record.drafts).map(([draftChannel, draft]) => <p key={draftChannel}><b>{draftChannel}</b> Ã‚Â· {draft.template} Ã‚Â· {new Date(draft.updatedAt).toLocaleString()}</p>) : <p>No saved channel drafts yet.</p>}</div></> : <div className="empty">Select a Final Match to prepare outreach.</div>}</section></section>
    {cycleControls}
  </main></div>;
}
