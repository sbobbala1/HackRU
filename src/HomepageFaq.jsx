import React from 'react';

const questions = [
  ['What is Vitra?', 'Vitra is a clinical trial discovery and recruitment support prototype. It helps people explore study information and helps researchers review preliminary, explainable matches.'],
  ['Does Vitra decide whether I am eligible for a study?', 'No. Any match is preliminary and is not a probability of eligibility. The research team must review the study criteria and confirm eligibility through screening.'],
  ['Where does trial information come from?', 'Public study listings are sourced from ClinicalTrials.gov. The original record remains the authoritative source for study details.'],
  ['Will expressing interest enroll me or contact a study team?', 'No. In this prototype, expressing interest records a local demo action. It does not automatically contact anyone or send medical information.'],
  ['How is my information handled?', 'The prototype uses synthetic demo profiles. In a real research workflow, sharing should happen only with informed consent and appropriate privacy protections.'],
  ['Can I use Vitra for medical advice?', 'No. Vitra does not diagnose, recommend treatment, or replace advice from a qualified healthcare professional.'],
];

export default function HomepageFaq() {
  return <section className="home-faq" aria-labelledby="faq-title"><div className="faq-heading"><span className="eyebrow">Good questions</span><h2 id="faq-title">Frequently asked questions</h2><p>A few helpful details about exploring clinical trials with Vitra.</p></div><div className="faq-list">{questions.map(([question, answer])=><details key={question}><summary>{question}<span aria-hidden="true"/></summary><p>{answer}</p></details>)}</div><a className="faq-more" href="/about">Want to learn more about Vitra? <span>About us →</span></a></section>;
}
