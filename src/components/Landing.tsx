import type { ReactNode } from "react";
import { Link, setDemoMode } from "../citizen/navigation.tsx";

function FieldIcon({ children }: { children: ReactNode }) {
  return <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

function MapPreview() {
  return <figure className="map-preview">
    <div className="preview-heading">
      <span className="eyebrow">Field atlas / Foam case</span>
      <span className="preview-label">Simulated example</span>
    </div>
    <div className="preview-result">
      <div><span className="preview-count">14 <span aria-hidden="true">→</span> <strong>7</strong></span><span className="preview-count-label">possible source stretches</span></div>
      <span className="preview-review">After a report is approved</span>
    </div>
    <svg className="preview-map" viewBox="0 0 600 370" role="img" aria-labelledby="preview-title preview-description">
      <title id="preview-title">How reviewed evidence narrows a stream investigation</title>
      <desc id="preview-description">An illustrated, simulated stream network. Grey dashed branches have been excluded by reviewed evidence. Seven possible source stretches remain blue. A gold ring marks a useful next observation site, not a confirmed source.</desc>
      <defs>
        <pattern id="atlas-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#cdd8ce" strokeWidth=".7"/></pattern>
      </defs>
      <rect width="600" height="370" fill="#eaf0e7"/>
      <rect width="600" height="370" fill="url(#atlas-grid)"/>
      <g fill="none" stroke="#cedacb" strokeWidth="1.2">
        <path d="M-20 115C65 8 195 5 222 67S112 186 133 252S213 351 154 390"/>
        <path d="M-20 141C83 33 182 32 196 78S87 177 107 260S181 340 123 390"/>
        <path d="M-20 173C67 83 147 51 164 91S54 196 81 275S136 354 88 390"/>
        <path d="M342-20C280 65 353 130 429 128S541 212 495 292S460 363 520 390"/>
        <path d="M373-20C305 70 377 105 434 102S574 204 522 304S494 361 551 390"/>
        <path d="M410-20C363 63 398 78 449 79S610 186 551 321S546 378 589 390"/>
      </g>
      <g fill="none" stroke="#7b8984" strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round">
        <path d="M30 222C70 218 107 212 146 228S201 251 251 245"/>
        <path d="M62 331C111 326 106 256 146 228"/>
        <path d="M23 296C70 283 83 247 108 222"/>
        <path d="M251 245C283 277 291 294 319 311S380 334 402 370"/>
      </g>
      <g fill="none" stroke="#245b83" strokeWidth="5" strokeLinecap="round">
        <path d="M60 37C95 57 113 71 126 100S158 150 189 172S214 218 251 245"/>
        <path d="M182 25C155 43 135 60 126 100"/>
        <path d="M299 36C276 79 318 120 331 154S292 216 251 245"/>
        <path d="M400 29C369 53 397 103 380 124S352 138 331 154"/>
        <path d="M531 80C483 76 453 88 425 106S400 122 380 124"/>
        <path d="M560 181C514 188 496 162 470 146S428 135 400 139L331 154"/>
      </g>
      <g fill="#fdfcf7" stroke="#245b83" strokeWidth="2"><circle cx="189" cy="172" r="6"/><circle cx="251" cy="245" r="6"/></g>
      <circle cx="146" cy="228" r="7" fill="#fdfcf7" stroke="#657575" strokeWidth="2"/>
      <path d="M146 228L110 172H30" fill="none" stroke="#657575" strokeWidth="1"/>
      <text x="30" y="157" fill="#43544b" fontSize="15">No foam seen</text>
      <circle cx="331" cy="154" r="17" fill="#fdfcf7" stroke="#916422" strokeWidth="2.5"/>
      <circle cx="331" cy="154" r="5" fill="#916422"/>
      <path d="M344 167L386 208H485" fill="none" stroke="#916422" strokeWidth="1"/>
      <text x="386" y="195" fill="#684a20" fontSize="15">Check here next</text>
      <g fill="#43544b" fontSize="11" letterSpacing="1.5"><text x="24" y="351">SCHEMATIC / DOWNSTREAM ↓</text><text x="503" y="351">COIMBRA</text></g>
    </svg>
    <figcaption><span><i className="legend-line candidate"/>Still possible</span><span><i className="legend-line preview-eliminated"/>Excluded</span><span><i className="preview-site-key"/>Next observation</span></figcaption>
    <p className="preview-note">A smaller search, not a confirmed source.</p>
  </figure>;
}

const features = [
  { title: "Guided citizen reports", text: "Record foam, colour, litter or discharge at an observation site. Report seen, not seen or cannot tell, then check the summary before sending it.", icon: <><path d="M7 3h10v18H7zM10 7h4M10 11h4M10 15h2"/><path d="M4 6h3M17 6h3"/></> },
  { title: "Researcher review", text: "A pending queue keeps new reports separate from approved evidence. Researchers can approve, reject, mark uncertain or withdraw a decision.", icon: <><path d="M5 3h14v18H5zM8 8l2 2 5-5M8 14h8M8 17h5"/></> },
  { title: "Three ways to read the network", text: "Use the geographic map, a stream connection diagram or a text list. Each shows the same possible source stretches and observation sites.", icon: <><path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/></> },
  { title: "Useful next-site suggestions", text: "The engine looks for an accessible, unchecked site where another observation could best divide the remaining possibilities.", icon: <><circle cx="12" cy="10" r="6"/><circle cx="12" cy="10" r="2"/><path d="M8 15l4 7 4-7M12 1v3M3 10h3M18 10h3"/></> },
  { title: "AI help, with a human check", text: "Groq helps turn a description into an observation draft. The citizen confirms it, and a researcher decides whether it can become evidence.", icon: <><path d="M4 5h16v12H9l-5 4zM8 9h8M8 13h5"/></> },
  { title: "Traceable, reversible decisions", text: "Evidence history records review changes. Withdrawing an approval recalculates the search, so previously excluded stretches can return.", icon: <><path d="M3 11a9 9 0 1 1 3 8M3 4v7h7M12 7v5l3 2"/></> },
];

export function Landing() {
  return <main id="main-content" tabIndex={-1} className="landing">
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="hero-heading">
        <p className="eyebrow">StreamTrace / Citizen observations. Researcher-reviewed evidence.</p>
        <h1 id="landing-title">Where should we check next?</h1>
      </div>
      <div className="hero-copy">
        <p className="landing-intro">Citizens report what they see in a stream. Researchers review it, and StreamTrace shows which stretches could be the source and where to look next.</p>
        <div className="landing-actions">
          <Link className="primary-action" href="/play">Begin the guided investigation <span aria-hidden="true">↗</span></Link>
          <Link className="secondary-action" href="/demo">Open the interactive demo</Link>
          <Link className="tertiary-action" href="/report" onClick={() => setDemoMode(false)}>Report what you see</Link>
          <Link className="tertiary-action" href="/login">Reviewer sign in</Link>
        </div>
        <div className="hero-field-note"><span className="eyebrow">Pilot field atlas</span><strong>Coimbra, Portugal</strong><p>Follow a visible signal upstream. Use the evidence to plan the next check.</p></div>
      </div>
      <MapPreview/>
    </section>

    <section className="project-intro landing-section" aria-labelledby="project-title">
      <p className="section-index">01 / The project</p>
      <div><h2 id="project-title">From a local observation<br/>to a focused investigation.</h2><p>Seeing something unusual in a stream gives you a place to start. StreamTrace connects that observation to the wider stream network, so researchers can work out which upstream stretches are still worth investigating.</p><p>It is a shared field guide: citizens collect observations, researchers check the evidence, and the engine helps choose where to look next.</p></div>
    </section>

    <section id="how-it-works" tabIndex={-1} className="how-it-works landing-section" aria-labelledby="how-title">
      <div className="section-heading"><p className="section-index">02 / The process</p><h2 id="how-title">How it works</h2><p>One report starts the loop. Each reviewed observation can make the next check more useful.</p></div>
      <ol>
        <li><div className="process-marker"><span>01</span><FieldIcon><path d="M4 20h4L20 8l-4-4L4 16zM13 7l4 4M4 20h16"/></FieldIcon></div><h3>A citizen reports an observation.</h3><p>Choose a site, record what you noticed, and answer a few context questions. Check the summary and submit it. No account needed.</p></li>
        <li><div className="process-marker"><span>02</span><FieldIcon><path d="M5 3h14v18H5zM8 8l2 2 5-5M8 14h8M8 17h5"/></FieldIcon></div><h3>A researcher reviews it.</h3><p>Check the observation and the case assumptions. Pending and uncertain reports stay out of the calculation. Approved evidence can narrow the search.</p></li>
        <li><div className="process-marker"><span>03</span><FieldIcon><path d="M4 4v6l8 4v7M20 4v6l-8 4"/><circle cx="4" cy="4" r="2"/><circle cx="20" cy="4" r="2"/><circle cx="12" cy="21" r="2"/></FieldIcon></div><h3>The map narrows the search and suggests the next site.</h3><p>See which stream stretches remain possible. Visit the suggested site, make another observation, and send it back for review.</p></li>
      </ol>
    </section>

    <section className="map-guide landing-section" aria-labelledby="map-guide-title">
      <div className="map-guide-copy"><p className="section-index">03 / Reading the map</p><h2 id="map-guide-title">A map of possibilities.<br/>A reason to look next.</h2><p>The map answers a specific question: given the approved observations, which stream stretches could still contain the source of this signal?</p><p className="map-guide-note">The next site is chosen for what you could learn there. It may not be the suspected source.</p></div>
      <dl className="map-guide-legend">
        <div><dt><i className="guide-line guide-candidate"/>Blue stretches</dt><dd>Possible source locations that still fit the approved evidence.</dd></div>
        <div><dt><i className="guide-line guide-excluded"/>Grey stretches</dt><dd>Locations excluded by that evidence under the case assumptions.</dd></div>
        <div><dt><i className="guide-site"/>The next observation site</dt><dd>A useful place to separate the remaining possibilities with another report.</dd></div>
      </dl>
      <p className="map-guide-rule"><strong>Why upstream?</strong> A seen signal keeps possible sources upstream of that site. A not-seen report can exclude upstream stretches only when persistence, detectability and comparability are confirmed. Conflicting evidence pauses the investigation for review.</p>
    </section>

    <section className="feature-section landing-section" aria-labelledby="features-title">
      <div className="section-heading"><p className="section-index">04 / The tools</p><h2 id="features-title">Built to follow the evidence.</h2><p>From the first field report to the next observation, with a human decision at each important step.</p></div>
      <div className="feature-list">{features.map(feature => <article className="feature-item" key={feature.title}><FieldIcon>{feature.icon}</FieldIcon><div><h3>{feature.title}</h3><p>{feature.text}</p></div></article>)}</div>
    </section>

    <section className="landing-modes landing-section" aria-labelledby="modes-title">
      <div className="section-heading"><p className="section-index">05 / Getting started</p><h2 id="modes-title">Explore the idea. Or work on a live case.</h2></div>
      <div className="mode-comparison"><article><span className="mode-chip">Demo (simulated)</span><h3>Try the whole investigation loop.</h3><p>No login needed. Approve a simulated report, see the map change, open the next site, and explore conflicting evidence. Reset whenever you like. Nothing is sent to the live system.</p></article><article><span className="mode-chip mode-live">Live</span><h3>Submit and review real observations.</h3><p>Citizens can report without an account. Researchers sign in to review stored reports, inspect the map and case history, and plan the next check. Only approved evidence affects the search.</p></article></div>
    </section>

    <section className="mission-section landing-section" aria-labelledby="mission-section-title" style={{ background: "rgba(36, 52, 59, 0.03)", padding: "60px 40px", borderRadius: "20px", marginTop: "40px" }}>
      <div className="section-heading"><p className="section-index">06 / Experience</p><h2 id="mission-section-title">Interactive Case Study</h2><p>Experience the complete investigation workflow in a guided, four-minute simulation. You will step into the roles of both a citizen reporting an anomaly and a researcher verifying evidence to narrow the search radius.</p></div>
      <div style={{ marginTop: "30px" }}>
        <Link className="primary-action" href="/play">Launch the scenario <span aria-hidden="true">↗</span></Link>
      </div>
    </section>

    <footer className="landing-footer"><span className="footer-mark">StreamTrace<span>Coimbra field atlas</span></span><p className="landing-trust">Built for the OneAquaHealth IEEE Hackathon. Pilot area: Coimbra, Portugal. Demo data is simulated. Supports investigation planning. Does not identify chemicals or certify water safety.</p></footer>
  </main>;
}
