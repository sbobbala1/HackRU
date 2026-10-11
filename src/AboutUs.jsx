import React from 'react';

const principles = [
  ['Start with real study records', 'Vitra helps people explore public ClinicalTrials.gov records and understand the information a study has shared.'],
  ['Make the next step clearer', 'Plain language and source-linked details help patients and research teams have more informed conversations.'],
  ['Keep people in control', 'Interest is voluntary. A person chooses what to share, and a qualified study team handles screening and enrollment decisions.'],
];

const founders = [
  { name: 'Sahasra Bobbala', major: 'Computer Engineering', year: 'Sophomore', image: new URL('./assets/founder-sahasra-optimized.jpg', import.meta.url).href },
  { name: 'Purvi Bojedla', major: 'Computer Science / Data Science', year: 'Sophomore', image: new URL('./assets/founder-purvi.jpg', import.meta.url).href },
  { name: 'Sanjana Gorantla', major: 'Computer Science / Data Science', year: 'Sophomore', image: new URL('./assets/founder-sanjana.png', import.meta.url).href },
  { name: 'Harini Talluri', major: 'Computer Science / Data Science', year: 'Sophomore', image: new URL('./assets/founder-harini-optimized.jpg', import.meta.url).href },
];

export default function AboutUs({ Header, Footer }) {
  return <><Header/><main className="about-page">
    <section className="about-page-hero">
      <span className="eyebrow">About Vitra</span>
      <h1>About us</h1>
      <p>We’re building Vitra to make clinical research easier to explore and understand. Our goal is to help people find clear information about studies and make informed choices, while giving research teams tools that keep source records and human review visible.</p>
    </section>
    <section className="about-page-story">
      <div className="about-page-image" role="img" aria-label="Fictional clinical research team"/>
      <div><span className="eyebrow">Research, made more understandable</span><h2>Better conversations begin with clearer information.</h2><p>Vitra is a discovery and recruitment support prototype. Patients can explore public study records and choose whether to express interest. Researchers can review source-grounded criteria and synthetic demo profiles.</p><p>Every match is preliminary. The study team remains responsible for confirming eligibility, explaining a study, and guiding informed consent.</p></div>
    </section>
    <section className="about-founders" aria-labelledby="about-founders-title">
      <div className="about-founders-heading"><span className="eyebrow">Meet the team</span><h2 id="about-founders-title">We’re the founders of Vitra.</h2><p>We’re four sophomore students building a clearer, more people-centered way to explore clinical research.</p></div>
      <div className="about-founder-grid">{founders.map((founder, index)=><article className="about-founder-card" key={founder.name}><img src={founder.image} alt={`Portrait of ${founder.name}`} loading="lazy"/><div className="about-founder-details"><span className="founder-number">0{index + 1}</span><h3>{founder.name}</h3><p>{founder.major}</p><span className="founder-year">{founder.year}</span></div></article>)}</div>
    </section>
    <section className="about-principles"><span className="eyebrow">What guides us</span><h2>Clarity, context, and choice.</h2><div>{principles.map(([title, text])=><article key={title}><span aria-hidden="true">✓</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="about-page-cta"><h2>Explore a study at your own pace.</h2><p>Review real trial records and decide what you would like to do next.</p><a className="btn" href="/signup?role=patient">Explore Vitra <span aria-hidden="true">→</span></a></section>
  </main><Footer/></>;
}
