# StreamTrace demo video: recording plan and voiceover

Status: proposed script, awaiting your approval. No recording has started.

Target length: **4 minutes 40 seconds**. This fits the supplied 3 to 5 minute requirement. Timestamps below are positions in the finished video, not how long each recording session takes.

Primary track: **Track 2, Data-to-Insight**. StreamTrace turns reviewed citizen observations into candidate stream stretches and a useful next check. Citizen Science UX, responsible AI support and prototype FHIR exports are supporting features.

The story: someone notices a freshwater concern, a researcher reviews it, and the system explains where another observation could help. Show the product working before explaining its architecture.

## What I will produce after approval

Record separate browser clips, trim them to this timeline, and assemble a silent video for your voiceover. Use the actual application, its existing transitions and its existing labels. Add restrained captions for track, simulation, live backend and benchmark evidence. Supply the individual clips and assembled MP4. Check the recording tools before capture; any installation or system permission is handled separately if needed.

You record the quoted voiceover blocks below. Send the audio before the final edit so pauses and cuts can match your delivery. The first silent assembly can use the proposed timings.

Approval of this plan includes one clearly labelled synthetic report submitted through the live backend and marked uncertain by the reviewer. It is a demonstration of persistence, not a genuine river observation. No database resets, migrations, bulk seeding or changes to unrelated reports are part of the recording plan.

## Recording direction

- Capture at 1920 x 1080, 16:9, aiming for 30 fps. Keep the application text readable; use a modest crop for details rather than shrinking an entire long page.
- Use a clean browser session. Keep reviewer sign-in and credential entry outside the footage. Preserve visible focus, selected options, loading completion and meaningful feedback.
- Record each state with roughly 2 seconds of extra footage at both ends. Cut waiting and repetitive typing; retain the approval click and resulting update together.
- Use mostly direct cuts. Keep existing chapter transitions where they help the story. Avoid fast zooms and decorative effects over important labels.
- Capture `/play` manually for the interaction shots. `/play?autoplay=1&record=1` is an optional source for opening footage: recording mode hides navigation only while autoplay is enabled and reduced effects are off. It does not set the finished video's duration.
- Mute application audio for capture. Your narration leads the finished video. No music is required.
- Keep `Simulated mission`, AI provider/fallback labels, outreach mockup disclosures and OpenStreetMap attribution visible when relevant. Add an edited caption if a close crop removes an important disclosure.

## Timeline at a glance

| Clip | Finished timestamp | Length | Screen | Main evidence |
| --- | --- | ---: | --- | --- |
| 01 | 00:00 to 00:18 | 18 s | `/` | Problem, One Health connection, primary track |
| 02 | 00:18 to 00:38 | 20 s | `/play`, opening and process | Guided citizen-to-researcher loop |
| 03 | 00:38 to 01:04 | 26 s | `/play`, chapter 3 | Observation, optional wording help, confirmation |
| 04 | 01:04 to 01:25 | 21 s | `/play`, chapters 4 and 5 | Pending has no effect; approval changes 14 to 4 |
| 05 | 01:25 to 01:48 | 23 s | `/play`, chapter 6 | Explainable next-site choice |
| 06 | 01:48 to 02:06 | 18 s | `/play`, chapter 7 | Outreach preview, explicitly a mockup |
| 07 | 02:06 to 02:25 | 19 s | `/play`, chapter 8 | Another reviewed observation changes 4 to 3 |
| 08 | 02:25 to 02:45 | 20 s | `/play`, chapters 8 and 9 | Conflict pause, withdrawal and evidence trail |
| 09 | 02:45 to 03:12 | 27 s | `/report?mode=live`, then receipt | Synthetic report submitted to the real backend |
| 10 | 03:12 to 03:33 | 21 s | `/review`, then receipt | Same report stored, reviewed and status updated |
| 11 | 03:33 to 03:47 | 14 s | `/demo` | Map, diagram and list alternatives |
| 12 | 03:47 to 04:05 | 18 s | `/docs#system`, live Case tab | Architecture and prototype FHIR export |
| 13 | 04:05 to 04:19 | 14 s | `/docs#evidence` | Synthetic benchmark, clearly bounded |
| 14 | 04:19 to 04:40 | 21 s | `/`, final caption | Field pilot, impact and claim boundary |

## Shot directions and timed voiceover

### 01. 00:00 to 00:18: why StreamTrace exists

Screen actions: hold the homepage hero for the first 7 seconds. Move to the introduction or the illustrated network for the remaining time. Overlay `StreamTrace | Track 2: Data-to-Insight` briefly.

Voiceover:

> A citizen spots foam in a stream. Where should a team check next? StreamTrace turns local observations into a focused investigation, connecting freshwater concerns with communities and aquatic ecosystems. Our primary track is Data-to-Insight.

Cut: move into the guided investigation after the question has landed.

### 02. 00:18 to 00:38: introduce the investigation

Screen actions: open `/play`. Show the opening river scene. Click `Why your observation matters`, enter `A shared investigation` with `Begin chapter`, and show the four-step process. Then advance to the citizen chapter. Capture the progression slowly; trim the extra chapter travel in the edit.

Voiceover:

> This guided case lets you experience both sides of the process: a citizen at the riverbank, and a researcher at the desk. It uses a simulated Coimbra stream investigation. The loop is simple: observe, review, narrow the search, and check again.

Caption: `Guided case | Simulated observations`.

### 03. 00:38 to 01:04: citizen report and wording assistance

Screen actions: enter chapter 3, `You are the citizen`. Use the default suggested site, 007, with `Seen`. Click `Use example observation`, then `Ask the assistant`. Show the resulting wording and its source badge. If clarification questions appear, use the labelled example answers and submit them as needed. Leave unknown context unknown. Check the confirmation box, then click `Submit simulated report`.

Voiceover:

> Here, I record foam at a selected site in plain language. Optional AI can help with wording and context questions, but I still check the report and confirm what I meant. If AI is unavailable, the form uses labelled standard text. Neither a draft nor my confirmation approves the evidence.

Cut: shorten provider waiting and repetitive question entry. Keep the source badge, confirmation and submission readable. Say `Optional AI` even if this take uses the fallback.

### 04. 01:04 to 01:25: review changes the search

Screen actions: show chapter 4, `Nothing gets lost`, with the submitted words and pending status. Enter chapter 5, `You are the researcher`, and show 14 possible reaches before review. Open `Citizen context` and `Read approval assumptions`. Acknowledge the case assumptions, then click `Approve`. Hold the map and count after they update to 4.

Voiceover:

> The citizen's words arrive with their context, but the search stays unchanged while the report is pending. As the researcher, I inspect the observation and acknowledge the model assumptions. Only after approval does this simulated case narrow from fourteen possible stream stretches to four.

Caption: `Pending: 14 | After approval: 4`.

### 05. 01:25 to 01:48: explain the next check

Screen actions: enter chapter 6, `Where would you check next?`. Select site 011 to show an unhelpful 4-versus-0 split. Then click `Use the best pick`. Show site 006 and its 1-versus-3 split beside the map. Keep both the site label and partition text readable.

Voiceover:

> Now we choose the next check by comparing what each answer could tell us. Checking the outlet leaves four or zero candidates, which cannot separate them. Site zero zero six splits them into one or three. The engine chooses the smallest worst-case remainder, and shows its reasoning.

Caption: `Next site = useful information | Not a confirmed source`.

### 06. 01:48 to 02:06: make the next observation understandable

Screen actions: enter chapter 7, `Ask for another observation`. Click `Draft outreach task`. Show the selected site, plain-language task and WhatsApp/SMS preview. Preserve the disclosure that volunteers are fictional and no messages are sent. Keep the response choices visible.

Voiceover:

> The next check becomes a clear request: look for foam from a safe public place, then report seen, not seen, or cannot tell. This messaging view is a mockup. No messages are sent, and the volunteers are fictional.

Cut: show the task before the conversation preview. Do not present the preview as an operational messaging integration.

### 07. 02:06 to 02:25: close the loop

Screen actions: enter chapter 8, `One more check`. Use the default site 006 and `Not seen` example. Show submission as pending. In researcher review, inspect context, acknowledge assumptions, check `Absence is comparable, persistent and detectable`, and use the labelled `Use example reason` when required. Approve and hold the 4-to-3 change.

Voiceover:

> A follow-up observation goes through the same review process. Not seeing foam only helps when persistence, visibility and comparability are checked. This example uses a labelled simulated review reason. Once approved, three stretches remain possible. That is a smaller search, not an identified pollutant.

Cut: compress repeated drafting steps. Keep the comparability check and approval result together. Never imply a genuine field check took place.

### 08. 02:25 to 02:45: conflicting evidence and an audit trail

Screen actions: while chapter 8 still shows the reviewed report, open `Try conflicting evidence` and click `Explore conflicting evidence`. Hold `Paused: researcher review needed`. Click `Withdraw and continue` and show the prior candidate set restored. Advance to chapter 9, `Your case file`, and show the evidence trail and decisions.

Voiceover:

> When approved evidence contradicts itself, recommendations pause for researcher review. Withdrawing the triggering approval restores the previous search. The case file keeps the observations, decisions and reasons together, so another researcher can inspect how the result changed instead of trusting a number alone.

Cut: use three short holds: pause message, restored count, evidence trail. Exit before chapter 10's impact screen.

### 09. 02:45 to 03:12: prove the live submission path

Screen actions: use a separate clean citizen session and open `/report?mode=live`. Select the foam case and a valid site, preferably 007. Choose `Seen`. Enter `I can see foam at this site. Video demonstration only; this is synthetic, not a field measurement.` Click `Check my report`, inspect the summary, confirm it, then `Continue to submit` and `Submit report`. Hold the resulting reference and `Pending researcher review` status.

Voiceover:

> The guided case is simulated. Now I switch to the live reporting flow, which uses the backend. Citizens can submit without an account. For this recording, I clearly label the observation as synthetic, check the summary, and submit it. The system returns a reference I can use to check its review status.

Caption: `Live backend | Synthetic demonstration observation`.

Cut: use short cuts between form steps, then a longer hold on the receipt. Do not replace a failed live submission with a simulated receipt.

### 10. 03:12 to 03:33: prove the same report reached a researcher

Screen actions: sign in outside the footage. In `/review`, select the same case and find the exact note from clip 09. Show it in the pending queue, then click `Mark uncertain`. Refresh the case or reload the signed-in page and open `Reviewed reports` to show it remains stored as uncertain. Return to the citizen's receipt and click `Refresh status`, showing `Uncertain`.

Voiceover:

> In the signed-in researcher queue, the same report is here. I mark this demonstration observation uncertain, so it stays recorded without narrowing the investigation. After refreshing, the decision is still there, and the citizen's reference shows the updated status. This connects reporting, storage and human review.

Caption: `Same report | Stored review decision | Citizen status updated`.

Cut: match the distinctive synthetic note across citizen and reviewer footage. Keep the session sign-in and personal reviewer details outside the frame.

### 11. 03:33 to 03:47: usable in more than one view

Screen actions: open `/demo` in a separate simulation session. Keep its demo label visible. Switch `Map`, `Diagram`, then `List`, holding each for about 4 seconds. Show the same candidate count across views. Preserve visible keyboard focus if using keyboard navigation.

Voiceover:

> The same investigation has a map, a connection diagram, and a text list. Users can follow the evidence without relying on colours alone. This reviewer demo stays clearly labelled as simulated.

Caption: `Simulated reviewer demo | Same evidence, three views`.

### 12. 03:47 to 04:05: architecture and interoperability

Screen actions: open `/docs#system` and frame the three architecture stages. Then cut to the live reviewer's `Case` tab and its actual FHIR download control. Download the bundle and show a short readable excerpt of its top-level `resourceType` and `type`; do not film a long JSON scroll. Preserve the prototype qualification with a caption.

Voiceover:

> React connects to a Hono API and Neon PostgreSQL. A deterministic TypeScript engine uses reviewed evidence, independently of AI. Access controls protect reports and review history. Prototype FHIR R4 exports support inspection and future integration; no profile conformance is claimed.

Caption: `Prototype FHIR R4 export | No profile conformance claimed`.

Cut: spend roughly 10 seconds on the architecture and 8 on the export. The guided case's FHIR link is a fixed simulated sample, so it must not stand in for this live case export.

### 13. 04:05 to 04:19: show measured prototype evidence

Screen actions: open `/docs#evidence`. Frame the benchmark table and its synthetic-data explanation. Highlight the balanced 30-reach row, showing 5.07 checks for bisection and 19.10 for random checks. Keep the original headings readable.

Voiceover:

> In the clean synthetic thirty-stretch benchmark, bisection averages about five checks, compared with nineteen for random checks. That measures simulated investigation efficiency. Field travel time and environmental outcomes still need a pilot.

Caption: `Synthetic benchmark | Clean observations | Mean checks to one candidate`.

Cut: keep this as one readable hold. Do not caption it as a field performance improvement.

### 14. 04:19 to 04:40: practical next step and impact

Screen actions: return to the homepage hero or its One Health section. Hold the product name and network illustration. Overlay the closing sentence in the last 7 seconds. Use only a verified public repository or working demo URL if adding links; no placeholder URL belongs in the final video.

Voiceover:

> Our next step is a local field pilot, comparing checks, review time and agreement with independent sampling. StreamTrace gives community observations a clear route to follow-up. It supports investigation planning; it does not identify chemicals or certify water safety. One observation, a useful next check.

Closing caption: `StreamTrace | Turn a stream observation into a useful next check.`

## Your voiceover recording

Read only the quoted paragraphs, in clip order. The proposed pace is approximately 125 to 135 words per minute, with short pauses for interface changes. Each block has its own time window; allow a short breath after questions and before candidate counts.

Record fourteen separately named takes, `vo-01` through `vo-14`, or one continuous take with brief pauses between blocks. Separate takes make retakes and timing easier. WAV at 48 kHz is preferred; a clean M4A recording is also usable. Use a calm, direct delivery rather than a promotional announcer voice.

Pronunciation: StreamTrace as “stream trace”; Coimbra as “ko-EEM-bra”; Hono as “HOH-no”; Neon as “NEE-on”; FHIR as “fire”; R4 as “R four”. Read site 006 as “zero zero six”. Read “reaches” as “stream stretches” where the script does so.

If a take runs slightly long, adjust the visual hold during editing. Keep the complete video under 5 minutes. Do not speed up the important review, conflict or receipt moments to fit an overlong voiceover.

## How this addresses the supplied judging criteria

| Criterion | Supplied weight | Where the video demonstrates it |
| --- | ---: | --- |
| Impact and mission alignment | 30% | Opening freshwater problem, citizen-to-researcher loop, limited field effort, field-pilot goals |
| Innovation and creativity | 20% | Explicit comparison of next-site partitions, explainable recommendations, guided role-based story |
| Technical implementation | 20% | Live report reaches the queue, persisted review and citizen status, independent engine, export |
| Usability and user experience | 15% | Plain-language report, confirmation, reference status, map/diagram/list |
| Feasibility and scalability | 15% | API/database separation, cached graph, inspectable exports and a concrete local pilot |

## Evidence notes and recording prerequisites

This plan was checked against current source and a direct, read-only execution of the mission model. It is not a completed browser recording or a fresh live service check. The verified model sequence is **14 initial candidates; seen at 007 and approved gives 4; the recommended site is 006 with a 1/3 partition; approved comparable absence there gives 3**. The 35/24/14/7 example in the project guide describes a different sequence. Do not mix those counts into these `/play` shots.

Before capture, verify browser recording and encoding tools, inspect the flows at the target resolution, and confirm live API/database access and the allowlisted reviewer session. Verify the site-011 partition in the UI before recording clip 05. Recheck the benchmark row and actual export contents before cutting clips 12 and 13.

If live capture is unavailable, leave clips 09 and 10 pending and report the blocker. Do not claim persistence from `/demo` footage. Any alternative edit and changed voiceover must be agreed before final assembly.

If the AI badge says `Standard text (AI unavailable)`, keep that visible. If a provider response changes the selected observation or site, correct and reconfirm it before proceeding; recheck the resulting counts. The engine result determines the captions, not the proposed edit.

Avoid filming `/play` chapter 10, `The Real-World Impact`: its current copy claims predictive anomaly detection, weeks-to-hours response improvements and remediation savings that this prototype does not establish. Use the project guide's measured synthetic benchmark and pilot goals instead. No product code change is proposed here.

FHIR export is a prototype, not proof of a deployed standards integration. Messaging previews are mockups. Candidate counts are possible modelled source stretches, not probabilities or verified pollution sources. One Health benefits are goals for field validation, not measured health outcomes.

The hackathon length, tracks and criterion weights in this document come from the context you supplied. This is a proposed submission narrative, not a fresh verification of the event's deadline or eligibility rules.

## Approval checkpoint

Approve this shot order and voiceover, or request changes to the wording, pacing or live demonstration. Until then, the work stops at this Markdown script. Recording, live report submission, provider calls and video assembly have not been started.
