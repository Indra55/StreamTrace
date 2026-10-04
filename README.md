# StreamTrace

### Someone notices a change in a stream. What happens next?

A patch of foam. An unusual colour. Dead fish near a footbridge.

A citizen can tell you where they saw something. But water moves, and the source of a problem may be farther upstream. A report is a starting point. Someone still has to decide what it means, where to investigate, and which observation would help next.

**StreamTrace helps turn that first observation into a useful next check.** Built for the **OneAquaHealth IEEE Global Hackathon**, it connects community reporting, researcher review, and an explainable stream map around one question: **“Where should we check next?”**

[Try the prototype](#try-it) · [OneAquaHealth connection](#our-oneaquahealth-connection) · [Technical guide](docs/technical-reference.md)

## The idea behind it

The starting point was the gap between collecting observations and acting on them. Citizen science gives communities a way to participate, but a growing collection of reports does not automatically become a clear investigation.

Field teams have limited time. Checking another location is useful only if it helps answer a question. StreamTrace focuses on that decision: use the observations a researcher trusts to narrow the possible source stretches, then suggest a site where another check could separate the remaining possibilities.

The goal is to give local observations a path into a decision someone can explain, question, and change.

## From noticing to following up

Imagine someone reports foam at a stream crossing. In StreamTrace, they choose a site, describe what they saw, and confirm the report. They can also say **“not seen”** or **“cannot tell”**. Optional AI helps with wording and context questions; the citizen stays in control of what gets submitted.

A researcher reviews the report before it affects the investigation. An absence needs extra care: could the person actually have seen the signal, and are the conditions comparable? An uncertain answer stays uncertain.

Once usable evidence is approved, the map shows which upstream stretches still fit. It suggests a next observation site and explains why that check could help. If a reviewer withdraws an approval, the result changes with it. If approved observations conflict, recommendations pause for review.

**The important part is the loop:** observe, review, learn something, and make the next check more useful.

## Why it matters

For **citizens**, this offers a way to contribute without needing ecological terminology or an account, and to check the status of their report afterward.

For **researchers and field teams**, it brings observations, review decisions, and investigation planning into one place. The intended benefit is to spend limited field effort on checks that reveal more, while keeping the reasoning visible.

For **communities and freshwater ecosystems**, the longer-term hope is earlier, better-informed follow-up on environmental concerns. Healthy waterways connect aquatic life, the surrounding environment, and human well-being. StreamTrace contributes to the investigation step in that One Health picture.

Those environmental and health benefits still need field validation. The prototype demonstrates the workflow; it has not measured improved water quality, reduced exposure, or restored biodiversity.

## Our OneAquaHealth connection

StreamTrace aligns primarily with **Track 2: Data-to-Insight**, with guided citizen reporting and human-reviewed AI support contributing to Tracks 1 and 3.

There is also a small, working data integration. In the **Live Portal**, you can load [conductivity samples published in the OneAquaHealth FHIR repository](https://github.com/hl7-eu/oah/blob/b907cf0869b59d82d9138b3d147fca66f333d911/_samples/crete/ec.csv). StreamTrace shows the original Crete site identifiers, sampling dates, instrument, and units, then calculates the change between sampling dates. Every result links back to its source.

These are historical reference samples from Giofyros and Almyros, separate from the Coimbra investigation. They demonstrate turning OneAquaHealth data into a readable insight, without treating conductivity as proof of pollution or water safety. This integration uses the public dataset, rather than a private citizen-app API.

## What the prototype shows

The interactive demo follows a bounded stream network near **Coimbra, Portugal**, built from OpenStreetMap data. It starts with **35 possible source stretches**. Simulated approved observations narrow that to **14**. Approving a pending, comparable absence reduces it to **7**; withdrawing that approval restores the previous result.

That is a smaller area to investigate, not a confirmed pollution source.

In [reproducible tests on three synthetic networks](benchmarks/RESULTS.md), the site-selection approach needed about **5 checks** on average to reach one candidate, compared with **16–19** for random checks under clean-observation conditions. These are model results, not measured savings in field time. Incorrect observations can still lead to an incorrect answer, which is why review matters.

The main design challenge is trust. A clear-looking map can be misleading if its inputs or assumptions are wrong. Reports remain separate from approvals, decisions can be reversed, and AI does not control the investigation logic. The model assumes one persistent source, normal downstream flow, and comparable observations. Flow direction and site access still need expert and field verification.

## Try it

### With Docker (Full Stack)

To run the entire application (Database, API, and Frontend) without a local Node.js setup, use Docker Compose. This automatically runs database migrations and stands up the complete stack:

```sh
docker compose up -d --build
```

The application will be available at `http://localhost:8080`.

### Local Development

Use **Node 22.18+**:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

- **`/play`**: follow the guided simulated investigation.
- **`/demo`**: explore the reviewer demo, approve a report, undo it, and try conflicting evidence. No account or database needed.
- **`/workflow`**: open the live citizen/reviewer portal and load the OneAquaHealth sample dataset. These features require the backend.

For real reporting and the dataset integration, follow the [backend setup guide](docs/technical-reference.md#node-backend-and-neon). Simulation is explicitly labelled and never silently replaces a failed live request.

## What comes next

The next meaningful step is a field pilot with researchers and community volunteers: verify the network and safe observation sites, compare suggested checks against a baseline, and measure how quickly reports become useful follow-up. An authorized citizen-app export or API would allow a deeper OneAquaHealth connection.

**StreamTrace supports investigation planning. It does not identify chemicals or certify water safety.**

For implementation and evidence, see the [technical reference](docs/technical-reference.md), [benchmark results](benchmarks/RESULTS.md), and [FHIR export notes](docs/fhir/README.md). Map attribution: © OpenStreetMap contributors, ODbL.
