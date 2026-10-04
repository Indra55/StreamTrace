import { Link } from "../citizen/navigation.tsx";
import benchmarkUrl from "../../benchmarks/RESULTS.md?url&no-inline";
import technicalReferenceUrl from "../../docs/technical-reference.md?url&no-inline";
import { FhirPrototype } from "./FhirPrototype.tsx";
import "./documentation.css";

const sections = [
  ["impact", "Why it matters"], ["process", "The investigation loop"], ["example", "A worked example"],
  ["evidence", "Evidence of impact"], ["system", "Inside the system"], ["start", "Try it yourself"],
];

function NextSiteDiagram() {
  return <figure className="docs-partition">
    <svg viewBox="0 0 640 260" role="img" aria-labelledby="partition-title partition-description">
      <title id="partition-title">Why site 009 is a useful first check</title>
      <desc id="partition-description">In the initial 35-reach Coimbra graph, seeing the signal at site 009 leaves 18 upstream candidates. A comparable not-seen observation leaves the other 17. At outlet site 011, the split is 35 versus zero, so it cannot separate candidates.</desc>
      <path d="M170 81H251Q270 81 270 102V172Q270 193 290 193H320M470 81H389Q370 81 370 102V172Q370 193 350 193H320" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="24" y="24" width="246" height="110" rx="8" fill="#e7eef2" stroke="#b7cbd7"/>
      <rect x="370" y="24" width="246" height="110" rx="8" fill="#e9eee5" stroke="#bbc8b5"/>
      <g textAnchor="middle" fill="#24343b">
        <text x="147" y="52" fontSize="13">IF SEEN</text><text x="147" y="91" fontSize="32">18 remain</text><text x="147" y="116" fontSize="13">Upstream of the site, including its reach</text>
        <text x="493" y="52" fontSize="13">IF NOT SEEN AND COMPARABLE</text><text x="493" y="91" fontSize="32">17 remain</text><text x="493" y="116" fontSize="13">The other candidate stretches</text>
      </g>
      <circle cx="320" cy="193" r="15" fill="#fdfcf7" stroke="#916422" strokeWidth="3"/>
      <circle cx="320" cy="193" r="4" fill="#916422"/>
      <text x="320" y="240" textAnchor="middle" fill="#684a20" fontSize="16">Site 009 · a useful 18 / 17 split</text>
    </svg>
    <figcaption>A partition schematic, not a geographic map. The outlet site 011 gives a 35 / 0 split and cannot separate the candidates.</figcaption>
  </figure>;
}

export function Documentation() {
  return <main id="main-content" tabIndex={-1} className="documentation">
    <header className="docs-intro">
      <p className="eyebrow">StreamTrace / Project guide</p>
      <h1>A local observation.<br/>A better next check.</h1>
      <p className="docs-lead">Someone notices foam in a stream. Where did it come from, and where should a team look next? StreamTrace connects citizen reports, researcher review and an explainable stream-network engine to help answer that second question.</p>
      <div className="docs-intro-links"><Link href="/play" className="primary-action">Try the guided investigation <span aria-hidden="true">↗</span></Link><a href="#impact">Read the project guide <span aria-hidden="true">↓</span></a></div>
      <div className="docs-atlas-facts"><span>Coimbra, Portugal</span><span>35 modelled stream stretches</span><span>11 prototype observation sites</span></div>
    </header>
    <div className="docs-layout">
      <nav className="docs-contents" aria-label="Project guide contents"><p className="eyebrow">In this guide</p>{sections.map(([id, label], index) => <a key={id} href={`#${id}`}><span aria-hidden="true">0{index + 1}</span>{label}</a>)}</nav>
      <div className="docs-body">
        <section id="impact" aria-labelledby="impact-title" className="docs-section">
          <p className="section-index">01 / Why it matters</p>
          <h2 id="impact-title">Make limited field time count.</h2>
          <p>A sighting tells us where a signal was observed. Its source could be farther upstream. Checking every stretch in order can waste effort, while collecting more reports without review can leave a team with more uncertainty.</p>
          <p>StreamTrace turns those reports into a search that researchers can inspect, correct and use to plan the next observation.</p>
          <div className="docs-benefits">
            <article><h3>For citizens</h3><p>Report without an account, confirm what you meant, and keep a reference to check its review status. Local noticing has a clear route to a researcher.</p></article>
            <article><h3>For researchers</h3><p>Review reports before they change the search. See why stretches were excluded and reverse an approval when the evidence changes.</p></article>
            <article><h3>For field teams</h3><p>Choose the next check for what it could teach you. An informative site can separate possibilities that another visit would leave unresolved.</p></article>
          </div>
          <aside className="docs-note"><strong>The One Health connection</strong><p>Freshwater concerns affect people, aquatic life and the surrounding environment. Better investigation planning could support earlier follow-up. Reduced exposure, biodiversity protection and faster real-world response are intended benefits that still need field evidence.</p></aside>
        </section>

        <section id="process" aria-labelledby="process-title" className="docs-section">
          <p className="section-index">02 / The investigation loop</p>
          <h2 id="process-title">Observe. Review. Narrow. Repeat.</h2>
          <p>Each case follows one visible signal: foam, colour, litter, dead fish or discharge. A report records “seen”, “not seen” or “cannot tell”. Other concerns go to a general inbox.</p>
          <figure className="docs-flow">
            <ol>
              <li><span className="docs-step">01</span><strong>Citizen report</strong><p>Choose a site, describe the observation, check the summary and submit.</p></li>
              <li><span className="docs-step">02</span><strong>Researcher review</strong><p>Check the report and assumptions. Only approved, usable evidence affects the search.</p></li>
              <li><span className="docs-step">03</span><strong>Engine calculation</strong><p>Update the possible source stretches and explain each exclusion.</p></li>
              <li><span className="docs-step">04</span><strong>Next observation</strong><p>Suggest a useful site. Its next report returns through the same review process.</p></li>
            </ol>
            <figcaption>Report → human review → explainable calculation → next check → report again.</figcaption>
          </figure>
          <div className="docs-rules"><article><h3>“Not seen” needs context.</h3><p>Absence excludes upstream stretches only with acknowledged assumptions and an explicit comparability check. An uncertain, rejected, unreviewed or “cannot tell” report cannot narrow the search.</p></article><article><h3>A result can change.</h3><p>Withdrawing an approval recalculates the candidates. Contradictory approved evidence can leave no candidates; the engine then pauses recommendations for researcher review.</p></article></div>
        </section>

        <section id="example" aria-labelledby="example-title" className="docs-section">
          <p className="section-index">03 / A worked example</p>
          <h2 id="example-title">Follow the foam case.</h2>
          <p>In the bundled Coimbra demo, these simulated observations narrow a 35-stretch search. A reach is one stream stretch in the model.</p>
          <figure className="docs-example">
            <ol>
              <li><strong>35</strong><div><span>Starting candidates</span><p>All stretches in the bounded study graph.</p></div></li>
              <li><strong>24</strong><div><span>Approved not seen at site 008</span><p>A comparable absence excludes 11 upstream stretches.</p></div></li>
              <li><strong>14</strong><div><span>Approved seen at site 010</span><p>Keep the remaining candidates upstream of that observation.</p></div></li>
              <li><strong>7</strong><div><span>Approve the pending absence at site 009</span><p>While it is pending, 14 remain. Approval leaves seven; withdrawal restores 14.</p></div></li>
            </ol>
            <figcaption>Simulated evidence. A smaller search is not a confirmed source or a water-safety result.</figcaption>
          </figure>
          <h3>How does it choose where to check?</h3>
          <p>For each eligible site, the engine asks what would remain after a seen or comparable not-seen observation. It chooses the site whose larger result is smallest. This is balanced bisection: either answer could help separate the possibilities.</p>
          <NextSiteDiagram/>
          <p>That 18 / 17 split applies to the initial 35 candidates, before the demo evidence. Recommendations update as approved evidence changes. Candidate counts describe stretches, not equal probabilities, waterway length or measured contamination.</p>
          <Link href="/demo" className="docs-inline-link">Approve a report and watch the search change <span aria-hidden="true">→</span></Link>
        </section>

        <section id="evidence" aria-labelledby="evidence-title" className="docs-section">
          <p className="section-index">04 / Evidence of impact</p>
          <h2 id="evidence-title">Fewer checks in the simulation.</h2>
          <p>The reproducible benchmark tests every possible origin on three synthetic networks. With clean, comparable observations, bisection reaches a single candidate in fewer checks than random or ascending-site checks.</p>
          <div className="docs-table-wrap" tabIndex={0} role="region" aria-label="Synthetic benchmark results, scroll horizontally on small screens">
            <table><caption>Mean checks to a single candidate · synthetic clean-observation scenario</caption><thead><tr><th scope="col">Network</th><th scope="col">Bisection</th><th scope="col">Random</th><th scope="col">Ascending</th></tr></thead><tbody>
              <tr><th scope="row">Chain · 24 reaches</th><td>4.67</td><td>16.48</td><td>12.46</td></tr>
              <tr><th scope="row">Balanced · 30 reaches</th><td>5.07</td><td>19.10</td><td>19.97</td></tr>
              <tr><th scope="row">Uneven · 24 reaches</th><td>4.71</td><td>16.02</td><td>14.46</td></tr>
            </tbody></table>
          </div>
          <p className="docs-fine-print">Fixed seed 20261003. Every origin; 50 random trials per origin. One persistent origin, normal downstream propagation and initially accessible sites. These graphs are synthetic, separate from the Coimbra map.</p>
          <details className="docs-detail"><summary>What happens when observations are missing or wrong?</summary><p>Missing checks can leave cases unresolved. In the erroneous scenario, flipping the first answer produces a wrong single candidate for bisection in every tested origin, without a conflict. A smaller search can still be wrong. Review quality and the model assumptions are essential.</p></details>
          <aside className="docs-note"><strong>What a field pilot needs to measure</strong><p>Compare checks and travel time against a baseline; measure report-to-review time, unresolved cases, and agreement with independent investigation or sampling. The current benchmark does not measure response time, exposure reduction or ecosystem recovery.</p></aside>
          <a href={benchmarkUrl} className="docs-inline-link">Read the full benchmark and methodology <span aria-hidden="true">↗</span></a>
        </section>

        <section id="system" aria-labelledby="system-title" className="docs-section">
          <p className="section-index">05 / Inside the system</p>
          <h2 id="system-title">Clear evidence. Explainable decisions.</h2>
          <figure className="docs-architecture">
            <ol><li><strong>Website</strong><span>React + TypeScript</span><p>Citizen reports, reviewer workspace, map, connection diagram and text list.</p></li><li><strong>API + database</strong><span>Hono + Neon PostgreSQL</span><p>Validate submissions, authenticate reviewers, store reports and review history with row-level security.</p></li><li><strong>Investigation engine</strong><span>Deterministic TypeScript</span><p>Use trusted approved evidence and the cached graph to return candidates, explanations and a next site.</p></li></ol>
            <div className="docs-ai-branch"><strong>Optional AI assistance</strong><p>Groq helps with drafts and task wording; Sarvam can transcribe voice input. Suggestions go back to the person for confirmation. AI confidence and text are never engine evidence.</p></div>
            <figcaption>Website → API → stored evidence → engine → results back to the website. Text assistance is a separate optional step.</figcaption>
          </figure>
          <details className="docs-detail"><summary>Data, privacy and exports</summary><p>The bundled OpenStreetMap graph contains 35 reaches and 11 prototype sites in a bounded Rio Mondego study area. Shared OSM nodes establish connections; geometric crossings do not. Cached data makes the demo reproducible. Attribution: OpenStreetMap contributors, ODbL.</p><p>Citizen location picking retains a site code and rounded distance rather than submitting raw device coordinates. The public report view exposes approved fields; private evidence and case exports require reviewer access. JSON and a base FHIR R4 Bundle support inspection, without clinical profile certification.</p></details>
          <div id="fhir"><FhirPrototype/></div>
          <aside className="docs-note docs-boundary"><strong>Know the model’s limits</strong><p>It assumes one persistent origin region, normal downstream propagation and comparable observations. Flow direction was checked visually for the prototype, not by hydrology experts. Physical access to sites is unverified, and the bounded graph cannot cover every upstream source.</p><p><strong>StreamTrace supports investigation planning; it does not identify chemicals or certify water safety.</strong> Stay on safe public paths, do not enter the water, and skip unsafe observations.</p></aside>
        </section>

        <section id="start" aria-labelledby="start-title" className="docs-section">
          <p className="section-index">06 / Try it yourself</p>
          <h2 id="start-title">See the loop before using it live.</h2>
          <div className="docs-rules"><article><h3>Guided investigation</h3><p>Step into citizen and researcher roles in a simulated foam case. Optional wording assistance may contact the API; its evidence stays simulated.</p><Link href="/play" className="docs-inline-link">Start the scenario <span aria-hidden="true">→</span></Link></article><article><h3>Interactive reviewer demo</h3><p>No login or backend needed. Approve the pending report, inspect the next site, withdraw the approval and load conflicting evidence. This demo makes no API or map-tile requests.</p><Link href="/demo" className="docs-inline-link">Open the demo <span aria-hidden="true">→</span></Link></article></div>
          <p>For real submissions, open the live portal. Citizens confirm and submit observations to the backend; allowlisted researchers sign in to review them. Live failures offer retry or an explicit simulation choice. Simulated reports never appear in the live queue.</p>
          <div className="docs-end-links"><Link href="/workflow" className="secondary-action">Open the live portal</Link><a href={technicalReferenceUrl}>Developer setup and API reference <span aria-hidden="true">↗</span></a></div>
        </section>
      </div>
    </div>
    <footer className="docs-footer"><Link href="/">StreamTrace</Link><p>Built for the OneAquaHealth IEEE Global Hackathon · Coimbra prototype · Simulated demonstrations, field impact to be validated.</p></footer>
  </main>;
}
