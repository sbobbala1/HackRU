import React from 'react';

const principles = [
  ['Start with real study records', 'Vitra helps people explore public ClinicalTrials.gov records and understand the information a study has shared.'],
  ['Make the next step clearer', 'Plain language and source-linked details help patients and research teams have more informed conversations.'],
  ['Keep people in control', 'Interest is voluntary. A person chooses what to share, and a qualified study team handles screening and enrollment decisions.'],
];

export default function AboutUs({ Header, Footer }) {
  return <><Header/><main className="about-page">
    <section className="about-page-hero">
      <span className="eyebrow">About Vitra</span>
      <h1>Connecting trials to possibility.</h1>
      <p>Clinical research can open doors, but finding and understanding a study is not always simple. Vitra brings study information and clear next steps together for patients and research teams.</p>
      <a className="btn" href="/#how">See how Vitra works <span aria-hidden="true">→</span></a>
    </section>
    <section className="about-page-story">
      <div className="about-page-image" role="img" aria-label="Fictional clinical research team"/>
      <div><span className="eyebrow">Research, made more understandable</span><h2>Better conversations begin with clearer information.</h2><p>Vitra is a discovery and recruitment support prototype. Patients can explore public study records and choose whether to express interest. Researchers can review source-grounded criteria and synthetic demo profiles.</p><p>Every match is preliminary. The study team remains responsible for confirming eligibility, explaining a study, and guiding informed consent.</p></div>
    </section>
    <section className="about-principles"><span className="eyebrow">What guides us</span><h2>Clarity, context, and choice.</h2><div>{principles.map(([title, text])=><article key={title}><span aria-hidden="true">✓</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="about-page-cta"><h2>Explore a study at your own pace.</h2><p>Review real trial records and decide what you would like to do next.</p><a className="btn" href="/signup?role=patient">Explore Vitra <span aria-hidden="true">→</span></a></section>
  </main><Footer/></>;
}
