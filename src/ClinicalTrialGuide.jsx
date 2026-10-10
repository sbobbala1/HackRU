import React from 'react';
import './clinical-trial-guide.css';

const steps = [
  { number: '01', title: 'Explore the study', text: 'Read the study purpose, who it is for, where it takes place, what participants may do, and the listed eligibility criteria. A public listing is a starting point; confirm current site availability with the study team.' },
  { number: '02', title: 'Talk with the study team', text: 'If the study seems worth exploring, contact the listed study team. They can explain the protocol, visits, time commitment, possible costs, and answer questions. A brief pre-screen may help decide whether full screening makes sense.' },
  { number: '03', title: 'Review informed consent', text: 'Before trial procedures begin, the team explains the study, foreseeable risks, possible benefits, alternatives, privacy, and your rights. Take time to ask questions and decide voluntarily. Signing a form does not guarantee enrollment.' },
  { number: '04', title: 'Complete screening', text: 'The study team reviews the protocol’s full requirements. Depending on the study, screening may include medical-history review, an exam, lab work, or other tests. Only the study team can determine whether you meet its criteria.' },
  { number: '05', title: 'Take part and stay in touch', text: 'If you are enrolled, the team explains the schedule and study procedures and monitors your safety as the protocol describes. Visits and activities vary; ask who to contact if questions or concerns come up.' },
  { number: '06', title: 'Finish or withdraw', text: 'Participation may end when study visits are complete, the study ends, or you choose to leave. Ask what follow-up is planned and how results may be shared. You can discuss your care with your usual healthcare professional.' },
];

const phases = [
  ['Phase 1', 'Often the first studies in people for a new drug or treatment; researchers primarily study safety and dosage.'],
  ['Phase 2', 'Studies a treatment in a larger group to learn more about how well it works and continue assessing safety.'],
  ['Phase 3', 'Usually involves larger groups and compares treatment approaches to gather more evidence about benefits and risks.'],
  ['Phase 4', 'May study a treatment after it is approved, to learn more about its use and effects in broader populations.'],
];

export default function ClinicalTrialGuide({ Header, Footer }) {
  return <><Header/><main className="trial-guide-page">
    <section className="trial-guide-hero"><div className="trial-guide-hero-copy"><span className="eyebrow">A plain-language starting point</span><h1>How clinical trials work</h1><p>Clinical trials are research studies with people. This guide walks through common steps, from finding a study to what happens after participation ends.</p><div className="trial-guide-actions"><a className="btn" href="https://clinicaltrials.gov/search" target="_blank" rel="noopener noreferrer">Search ClinicalTrials.gov ↗</a><a className="guide-secondary-link" href="/how-it-works">How Vitra supports discovery →</a></div></div><div className="trial-guide-hero-image" role="img" aria-label="Clinical research professionals reviewing study information"/></section>

    <section className="trial-guide-sequence" aria-labelledby="trial-guide-sequence-title"><div className="trial-guide-heading"><span className="eyebrow">The participant journey</span><h2 id="trial-guide-sequence-title">What usually happens</h2><p>Every study is different. The study team can explain how these steps apply to its protocol and location.</p></div><ol className="trial-guide-steps">{steps.map(step=><li className="trial-guide-step" key={step.number}><span className="trial-guide-number" aria-hidden="true">{step.number}</span><div className="trial-guide-step-copy"><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol></section>

    <section className="trial-guide-basics"><div className="guide-basics-copy"><span className="eyebrow">A few useful basics</span><h2>Every study asks a different question.</h2><p>Some trials test an intervention, such as a medicine, device, or care approach. Observational studies collect information about health without assigning an intervention. Not every clinical study uses drug-development phases.</p><p>Eligibility criteria are study-specific. Age, health history, treatments, lab results, and other details may matter. A listing or automated match cannot confirm eligibility.</p><p className="guide-registry-note">ClinicalTrials.gov is a public registry. Study sponsors or investigators submit the information, and a listing does not mean the U.S. government has approved or endorsed the study. Record status can change, so confirm details with the study site.</p><a href="https://www.fda.gov/consumers/health-education-resources/clinical-trial-participation" target="_blank" rel="noopener noreferrer">FDA: learn about taking part ↗</a></div><aside className="guide-question-card"><h3>Questions to ask before deciding</h3><ul><li>What is the goal, and what would I need to do?</li><li>What are the possible risks, benefits, and alternatives?</li><li>How many visits are there, and where do they happen?</li><li>Could travel or other costs be involved?</li><li>Who can I contact if I have questions or want to leave?</li></ul><p>There is no pressure to join. Ask the team for time to review the details with someone you trust.</p></aside></section>

    <section className="trial-guide-phases"><div className="trial-guide-heading"><span className="eyebrow">For some treatment studies</span><h2>What do “phases” mean?</h2><p>Drug-development phases describe common goals at different points in testing. Not every study fits this sequence, and phase alone does not tell you whether a study is right for you.</p></div><div className="phase-grid">{phases.map(([title,text])=><article key={title}><span>{title}</span><p>{text}</p></article>)}</div><a className="phase-source" href="https://www.fda.gov/patients/drug-development-process/step-3-clinical-research" target="_blank" rel="noopener noreferrer">FDA: clinical research and phases ↗</a></section>

    <section className="trial-guide-after"><div><span className="eyebrow">Your choice matters</span><h2>Interest is not enrollment.</h2><p>Expressing interest or contacting a site does not sign you up. The study team explains the specific protocol, completes screening, and answers questions before any decision to participate.</p><a href="https://www.cancer.gov/research/participate/clinical-trials/what-to-expect" target="_blank" rel="noopener noreferrer">NCI: what to expect before, during, and after a trial ↗</a></div><div className="guide-after-actions"><a className="btn" href="https://clinicaltrials.gov/search" target="_blank" rel="noopener noreferrer">Browse public study records ↗</a><a href="/locations">Explore locations on Vitra →</a></div></section>

    <section className="trial-guide-sources" aria-label="Official sources"><h2>Official sources</h2><p>This overview summarizes public information; it is not medical advice or a decision about eligibility.</p><ul><li><a href="https://www.cancer.gov/research/participate/clinical-trials/what-to-expect" target="_blank" rel="noopener noreferrer">National Cancer Institute: What to Expect During a Clinical Trial</a></li><li><a href="https://www.fda.gov/consumers/health-education-resources/clinical-trial-participation" target="_blank" rel="noopener noreferrer">U.S. Food and Drug Administration: Clinical Trial Participation</a></li><li><a href="https://www.hhs.gov/ohrp/regulations-and-policy/guidance/faq/informed-consent/index.html" target="_blank" rel="noopener noreferrer">HHS Office for Human Research Protections: Informed Consent FAQs</a></li><li><a href="https://clinicaltrials.gov/find-studies/how-to-search" target="_blank" rel="noopener noreferrer">ClinicalTrials.gov: How to search for clinical studies</a></li><li><a href="https://clinicaltrials.gov/about-site/disclaimer" target="_blank" rel="noopener noreferrer">ClinicalTrials.gov: Disclaimer</a></li></ul></section>
    <section className="trial-guide-research-feature" aria-labelledby="trial-guide-feature-title">
      <div className="trial-guide-feature-copy">
        <span className="eyebrow">Research &amp; innovation</span>
        <h2 id="trial-guide-feature-title">New discoveries begin with people.</h2>
        <p>Clinical research helps teams study new approaches to health. Vitra makes public study information easier to explore, while study teams remain responsible for screening and enrollment.</p>
        <div className="trial-guide-feature-actions">
          <a className="btn" href="/how-it-works">How Vitra supports discovery <span aria-hidden="true">→</span></a>
          <a className="trial-guide-feature-secondary" href="https://clinicaltrials.gov/search" target="_blank" rel="noopener noreferrer">Search clinical trials ↗</a>
        </div>
      </div>
      <div className="trial-guide-feature-art" role="img" aria-label="Illustration of a DNA strand representing research and discovery">
        <svg viewBox="0 0 620 420" aria-hidden="true">
          <path className="dna-backbone" d="M160 20 C470 80 150 140 460 200 S150 320 460 400"/>
          <path className="dna-backbone dna-backbone-alt" d="M460 20 C150 80 470 140 160 200 S470 320 160 400"/>
          <g className="dna-rungs"><path d="M220 34L400 34M265 72L355 72M300 110L320 110M270 150L350 150M210 188L410 188M210 228L410 228M270 268L350 268M300 308L320 308M265 348L355 348M220 386L400 386"/></g>
          <circle cx="460" cy="200" r="17" className="dna-highlight"/><circle cx="160" cy="200" r="17" className="dna-highlight"/>
        </svg>
        <span className="feature-tag">Explore what’s possible</span>
      </div>
    </section>
  </main><Footer/>;</>
}
