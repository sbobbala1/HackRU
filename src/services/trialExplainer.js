export const sampleQuestions = ['What is this study trying to find out?', 'Who may be able to participate?', 'What would I need to do during the study?'];
const guidance = 'This explains the public study record. It does not determine eligibility or recommend treatment. Official screening is required.';
const paths = {
  purpose: ['descriptionModule.briefSummary', 'descriptionModule.detailedDescription', 'designModule.designInfo.primaryPurpose'],
  eligibility: ['eligibilityModule.eligibilityCriteria', 'eligibilityModule.minimumAge', 'eligibilityModule.maximumAge'],
  participation: ['armsInterventionsModule.interventions', 'armsInterventionsModule.armGroups', 'descriptionModule.detailedDescription'],
  visits: ['descriptionModule.briefSummary','descriptionModule.detailedDescription','armsInterventionsModule.armGroups'],
  risks: ['descriptionModule.briefSummary','descriptionModule.detailedDescription','armsInterventionsModule.interventions'],
  unclear: ['eligibilityModule.eligibilityCriteria'],
};
const read = (obj,path)=>path.split('.').reduce((v,k)=>v?.[k],obj);
function text(value) {
  if (typeof value==='string') return value;
  if (Array.isArray(value)) return value.map(x=>[x.name,x.label,x.description].filter(Boolean).join(': ')).filter(Boolean).join('\n');
  return '';
}
export function classifyQuestion(question) {
  const q=question.toLowerCase().trim();
  if (/ignore|system prompt|pretend|invent|make up|guarantee|should i|safe for me|suitable for me|am i eligible|will .*cure|treatment advice/.test(q)) return null;
  if (/unclear|ambiguous|missing.*eligib/.test(q)) return 'unclear';
  if (/how many.*visits?|visit.*schedule|number of visits/.test(q)) return 'visits';
  if (/risks?|burdens?|side effects?/.test(q)) return 'risks';
  if (/who.*participat|eligib|requirements|who.*join/.test(q)) return 'eligibility';
  if (/need to do|procedures?|during the study|participation involve/.test(q)) return 'participation';
  if (/trying to find|purpose|study about|aim|objective/.test(q)) return 'purpose';
  return null;
}
export function explainTrial(trial, question, language='en') {
  const base={question, citations:[], topic:null, method:'Source-based explanation', guidance, answer:'', general:[]};
  if (language!=='en' || /[^\x00-\x7F]/.test(question.replace(/[’“”–—]/g,''))) return {...base, answer:'This demo supports English questions and answers only. Translation is not available. Please use an English sample question.'};
  const topic=classifyQuestion(question);
  if (!topic) return {...base, answer:'I cannot answer that from the supported study fields. Try a sample question. I cannot recommend treatment, judge personal suitability, or invent missing information.'};
  const p=trial.protocolSection || {};
  let citations=(paths[topic]||[]).map(path=>({path:'protocolSection.'+path, label:path.split('.').pop(), quote:text(read(p,path))})).filter(x=>x.quote.trim());
  if (topic==='visits' || topic==='risks' || topic==='unclear') {
    const pattern=topic==='visits'?/\b(visits?|appointments?|clinic sessions?)\b/i:topic==='risks'?/\b(risks?|burdens?|adverse|side effects?|discomfort|pain|inconvenience)\b/i:/\b(investigator|judgment|judgement|adequate|stable|significant|appropriate|acceptable)\b/i;
    citations=citations.flatMap(x=>x.quote.split(/(?<=[.!?])\s+|\n/).filter(sentence=>pattern.test(sentence)).map(quote=>({...x,quote})));
  }
  citations=citations.slice(0,6).map((x,i)=>({...x,id:`S${i+1}`,url:trial.studyUrl}));
  const missing={purpose:'The available record does not describe the study purpose.',eligibility:'The available record does not list participation criteria.',participation:'The available fields do not give enough information about what participants would do.',visits:'I could not find an explicit visit schedule in the available fields. Study duration and outcome time frames are not visit counts.',risks:'I could not find an explicit description of risks or burdens in the available fields. This does not mean the study has no risks.',unclear:'I could not identify wording requiring investigator judgment in the available eligibility text. This does not establish that every requirement is clear.'};
  const introductions={purpose:'The study describes its purpose in the excerpts below.',eligibility:'These are the listed participation requirements. Meeting them must be confirmed by the study team.',participation:'These excerpts describe study activities. They may not be a complete participation schedule.',visits:'The following excerpts mention visits. I cannot infer a total unless the source explicitly states one.',risks:'These excerpts describe risks or burdens. They are not a complete safety assessment.',unclear:'These excerpts use judgment-based wording. Ask the study team how these requirements are assessed.'};
  return {...base,topic,citations,answer:citations.length?introductions[topic]:missing[topic], general:topic==='eligibility'?['General explanation: Inclusion criteria are requirements for joining. Exclusion criteria are reasons someone may be unable to join.']:topic==='purpose'?['General explanation: A study tests a research question. Its purpose does not establish that participants will benefit.']:[]};
}
