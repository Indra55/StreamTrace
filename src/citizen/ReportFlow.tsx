import { ObservationText, ObservationChoice } from "../components/ReportPanels.tsx";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ApiError, request, casesSchema, networkSchema, type LiveCase } from "../api.ts";
import { network, type Network } from "../demo.ts";
import SitePicker from "./SitePicker.tsx";
import VoiceInput from "./VoiceInput.tsx";
import { CitizenFrame, demoMode, setDemoMode, navigate } from "./navigation.tsx";
import { addDemoReport } from "./demo-store.ts";
import { draftKey, restoreDraft, saveDraft, parseDescription, valueLabels, rememberReceipt, draftResponseSchema, draftText, type CitizenDraft } from "./model.ts";
import { caseTitle, signalLabels, contextLabels, contextText, emptyAssumptions, referenceSchema, type GuideQuestion, type Assumptions } from "../../shared/observations.ts";
import { clarificationQuestions, draftInputSchema, type Draft, type DraftInput } from "../../shared/ai.ts";
type Step = "where" | "value" | "description" | "guide" | "confirm" | "submit";
type Reply = { field: GuideQuestion["field"]; question: string; answer: string };
const simulatedCase: LiveCase = { id: "coimbra-foam-demo", title: "Foam investigation", signal: "foam", assumptions: "Simulated case", network_id: "demo", simulated: true };

export default function ReportFlow({ simulatedOnly = false }: { simulatedOnly?: boolean }) {
  const [draft, setDraft] = useState(restoreDraft), [step, setStep] = useState<Step>("where"), [simulated, setSimulated] = useState(() => simulatedOnly || demoMode());
  const [voiceBusy, setVoiceBusy] = useState(false), [transcriptionLabel, setTranscriptionLabel] = useState("");
  const [availableCases, setAvailableCases] = useState<LiveCase[]>([]);
  const [chosenCase, setChosenCase] = useState(() => new URLSearchParams(location.search).get("case") ?? draft.caseId);
  const [currentCase, setCurrentCase] = useState<LiveCase | null>(simulated ? simulatedCase : null), [data, setData] = useState<Network | null>(simulated ? network : null);
  const [loading, setLoading] = useState(!simulated), [unavailable, setUnavailable] = useState(false), [retry, setRetry] = useState(0);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [questions, setQuestions] = useState<GuideQuestion[]>([]), [replies, setReplies] = useState<Record<number, string>>({});
  const [round, setRound] = useState(0), [helping, setHelping] = useState(false), [confirmed, setConfirmed] = useState(false), [saving, setSaving] = useState(false), [storageBlocked, setStorageBlocked] = useState(false);
  const answers = useRef<Reply[]>([]), helpVersion = useRef(0), submitting = useRef(false), card = useRef<HTMLElement>(null);
  useEffect(() => { const heading = card.current?.querySelector("h1"); if (heading) { heading.tabIndex = -1; heading.focus(); } }, [step, round]);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    if (simulated) { setCurrentCase(simulatedCase); setData(network); setLoading(false); setDraft(d => ({ ...d, caseId: simulatedCase.id, signal: d.general ? "other" : "foam", site: new URLSearchParams(location.search).get("site") ?? d.site })); return; }
    setLoading(true); setUnavailable(false); setError("");
    request<unknown>("/api/cases", { signal: controller.signal }).then(async response => {
      const cases = casesSchema.parse(response).filter(c => !c.simulated && c.signal in signalLabels && c.signal !== "other");
      if (!active) return;
      setAvailableCases(cases);
      const selected = cases.find(c => c.id === chosenCase) ?? cases[0];
      if (!selected) { setCurrentCase(null); setData(null); setDraft(d => ({ ...d, caseId: "", general: true, signal: "other", site: "", distance: undefined })); return; }
      const next = z.object({ graph: networkSchema }).parse(await request(`/api/cases/${selected.id}/network`, { signal: controller.signal }));
      if (!active) return;
      const site = new URLSearchParams(location.search).get("site");
      setCurrentCase(selected); setData(next.graph);
      setDraft(d => ({ ...d, caseId: selected.id, signal: d.general ? "other" : selected.signal as CitizenDraft["signal"], site: next.graph.sites.some(s => s.code === (site ?? d.site)) ? site ?? d.site : "", distance: undefined }));
    }).catch(e => { if (active && !(e instanceof Error && e.name === "AbortError")) { setUnavailable(true); setError("The reporting service is unavailable. Your report has not been submitted. Try again when it is connected."); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); helpVersion.current++; };
  }, [simulated, retry, chosenCase]);
  useEffect(() => { setStorageBlocked(!saveDraft(draft)); setConfirmed(false); }, [draft]);
  function update(patch: Partial<CitizenDraft>) { setDraft(d => ({ ...d, ...patch })); setConfirmed(false); setError(""); }
  function setGeneral(general: boolean) { update({ general, signal: general ? "other" : currentCase?.signal as CitizenDraft["signal"] ?? "foam", assumptions: { ...emptyAssumptions } }); setNotice(""); }
  function inputFor(next: CitizenDraft, answered: Reply[], nextRound: number): DraftInput {
    const replyAnswers: NonNullable<DraftInput["answers"]> = {};
    for (const reply of answered) if (reply.field !== "value") replyAnswers[reply.field] = reply.answer.startsWith("Yes") ? "yes" : reply.answer.startsWith("No") ? "no" : "unknown";
    return draftInputSchema.parse({ text: draftText(next), signal: next.signal, siteHint: next.site, round: nextRound, answers: replyAnswers });
  }
  function localQuestions(next: CitizenDraft, answered: Reply[], nextRound: number): GuideQuestion[] {
    if (next.general) return [];
    const input = inputFor(next, answered, nextRound);
    const assumptions: Draft["assumptions"] = { persistence: next.assumptions.persistence === null ? "unknown" : next.assumptions.persistence ? "yes" : "no",
      detectability: next.assumptions.detectability === null ? "unknown" : next.assumptions.detectability ? "yes" : "no",
      flow_conditions: next.assumptions.flow === null ? "unknown" : next.assumptions.flow ? "yes" : "no", recent_rain: next.assumptions.recent_rain === "cannot_tell" ? "unknown" : next.assumptions.recent_rain };
    return clarificationQuestions(next.value, assumptions, nextRound, input.answers).map(q => ({ ...q, field: q.id }));
  }
  function finishDraft(next: CitizenDraft, answered: Reply[], nextRound: number, supplied?: Draft["questions"]) {
    setDraft(next); setReplies({});
    const pending = next.general || next.value !== "absent" || nextRound >= 2 ? [] : supplied ? supplied.map(q => ({ ...q, field: q.id })) : localQuestions(next, answered, nextRound);
    setQuestions(pending); setRound(nextRound); setStep(pending.length ? "guide" : "confirm");
  }
  async function resolveDraft(next: CitizenDraft, answered: Reply[], nextRound: number) {
    setStep("guide"); setHelping(true); setReplies({});
    const version = ++helpVersion.current;
    if (next.general) { finishDraft({ ...next, source: "manual" }, answered, nextRound); setHelping(false); return; }
    if (simulated) { setNotice("Demo uses the simple form. No AI request is sent."); finishDraft(parseDescription(next), answered, nextRound); setHelping(false); return; }
    try {
      const response = draftResponseSchema.parse(await request("/api/draft", { method: "POST", body: JSON.stringify(inputFor(next, answered, nextRound)), signal: AbortSignal.timeout(6500) }));
      if (version !== helpVersion.current) return;
      if (response.signal !== next.signal) throw new Error("Unexpected draft signal");
      const a = response.assumptions, value = !response.flags.length && next.value !== "cannot_tell" ? next.value : response.value;
      const updated: CitizenDraft = { ...next, value, assumptions: { persistence: a.persistence === "unknown" ? null : a.persistence === "yes", detectability: a.detectability === "unknown" ? null : a.detectability === "yes",
        flow: a.flow_conditions === "unknown" ? null : a.flow_conditions === "yes", recent_rain: a.recent_rain === "unknown" ? "cannot_tell" : a.recent_rain }, source: response.source === "ai" ? "ai_draft" : "parser_draft" };
      setNotice(response.flags.length ? response.rationale_en : response.source === "fallback" ? "Automatic help unavailable, using simple form" : "");
      finishDraft(updated, answered, nextRound, value === response.value ? response.questions : undefined);
    } catch { if (version === helpVersion.current) { setNotice("Automatic help unavailable, using simple form"); finishDraft(parseDescription(next), answered, nextRound); } }
    finally { if (version === helpVersion.current) setHelping(false); }
  }
  async function guide() {
    setNotice(""); answers.current = []; setRound(0);
    await resolveDraft(draft, [], 0);
  }
  function answerRound() {
    const next = { ...draft, assumptions: { ...draft.assumptions } };
    const additions = questions.map((question, i) => ({ field: question.field, question: question.text, answer: replies[i]! }));
    for (const reply of additions) {
      if (reply.field === "value") next.value = reply.answer === "Seen" ? "present" : reply.answer === "Not seen" ? "absent" : "cannot_tell";
      else next.assumptions = { ...next.assumptions, [reply.field]: reply.field === "recent_rain" ? reply.answer.startsWith("Yes") ? "yes" : reply.answer.startsWith("No") ? "no" : "cannot_tell" : reply.answer.startsWith("Yes") ? true : reply.answer.startsWith("No") ? false : null };
    }
    answers.current = [...answers.current, ...additions];
    void resolveDraft(next, answers.current, round + 1);
  }
  async function submit() {
    if (!confirmed || submitting.current || unavailable) return; submitting.current = true; setSaving(true); setError("");
    try {
      let ref: string;
      if (simulated) ref = addDemoReport(draft);
      else {
        if (!draft.general && (!currentCase || !data?.sites.some(s => s.code === draft.site))) throw new Error("Choose a site in this investigation before submitting.");
        const response = await request<unknown>("/api/reports", { method: "POST", body: JSON.stringify({ id: draft.id, case_id: draft.general ? null : currentCase!.id, signal: draft.general ? "other" : currentCase!.signal, site_code: draft.site || null, value: draft.value, confirmed: true, origin: "web", observed_at: draft.observedAt, notes: draft.text, citizen_context: { source: draft.source, assumptions: draft.assumptions, ...(draft.distance === undefined ? {} : { site_distance_m: draft.distance }) } }) });
        ref = z.object({ ref: referenceSchema }).parse(response).ref;
      }
      rememberReceipt(ref, simulated, draft.general ? null : currentCase?.id ?? null);
      try { window.localStorage.removeItem(draftKey); } catch { /* Reference stays visible. */ }
      navigate(`/report/${encodeURIComponent(ref)}`);
    } catch (e) { setError(e instanceof ApiError && e.status === 409 ? "This report was already submitted. Use its reference to check the status." : e instanceof Error ? e.message : "Submission failed. Your unfinished report is saved."); }
    finally { submitting.current = false; setSaving(false); }
  }
  const stepNumber = step === "where" ? 1 : ["value", "description"].includes(step) ? 2 : step === "submit" ? 4 : 3;
  return <CitizenFrame simulated={simulated}>
    <p className="current-investigation"><strong>Current investigation:</strong> {loading ? "Loading..." : currentCase ? caseTitle(currentCase) : "No active investigation"}</p>
    <p className="eyebrow">Citizen field report / Step {stepNumber} of 4</p>
    <p className="privacy-line">No name, phone or exact location collected. Do not put personal details in your description.</p>
    {!simulated && <p className="citizen-notice">Your report will be saved for signed-in researchers to review.</p>}
    {notice && <p className="citizen-notice" role="status">{notice}</p>}{storageBlocked && <p role="status">Saving on this device is unavailable. Keep this page open until you submit.</p>}{error && <p className="api-error" role="alert">{error}</p>}
    <section ref={card} className="citizen-card" aria-busy={loading || helping || saving}>
      {step === "where" && <>
        <h1>Where are you looking?</h1>
        {!simulated && availableCases.length > 1 && <label>Investigation<select aria-label="Investigation" value={currentCase?.id ?? ""} disabled={loading} onChange={e => {
          helpVersion.current++; answers.current = []; setQuestions([]); setNotice("");
          update({ caseId: e.target.value, general: false, site: "", distance: undefined, text: "", value: "cannot_tell", assumptions: { ...emptyAssumptions }, source: "manual" });
          setChosenCase(e.target.value);
        }}>{availableCases.map(c => <option key={c.id} value={c.id}>{caseTitle(c)}</option>)}</select></label>}
        {currentCase && <p>This investigation asks about <strong>{signalLabels[currentCase.signal as keyof typeof signalLabels]?.toLowerCase()}</strong>.</p>}
        <div className="citizen-choice-row">{currentCase && <button aria-pressed={!draft.general} onClick={() => setGeneral(false)}>Report {signalLabels[currentCase.signal as keyof typeof signalLabels]?.toLowerCase()}</button>}<button aria-pressed={draft.general} onClick={() => setGeneral(true)}>Something else</button></div>
        {draft.general && <p className="citizen-notice">This goes to the general inbox. It is not linked to an investigation and never changes candidate stretches.</p>}
        {loading ? <p role="status">Loading observation sites...</p> : unavailable ? <><button onClick={() => setRetry(n => n + 1)}>Retry connection</button><button onClick={() => { setSimulated(true); setUnavailable(false); setError(""); setDemoMode(true); }}>Try a simulated report</button></> : data ? <SitePicker data={data} value={draft.site} onChange={(site, distance) => update({ site, distance })}/> : <p>You can send a general observation without selecting a site.</p>}
        {draft.site && <p>Selected site: <strong>{draft.site}</strong>{draft.distance === undefined ? "" : `, about ${draft.distance} m away`}</p>}
        <button disabled={loading || unavailable || (!draft.general && !draft.site)} onClick={() => setStep(draft.general ? "description" : "value")}>Continue</button>
      </>}
      {step === "value" && <><h1>Did you see {signalLabels[draft.signal].toLowerCase()}?</h1><p>Site {draft.site}</p><ObservationChoice value={draft.value} onChange={value => update({ value, assumptions: { ...emptyAssumptions } })}/><button onClick={() => setStep("description")}>Continue</button></>}
      {step === "description" && <><h1>{draft.general ? "What did you notice?" : "Anything you want to add?"}</h1><ObservationText text={draft.text} onChange={text => update({ text })} disabled={voiceBusy} optional={!draft.general}/>
        <VoiceInput simulated={simulated} cannedTranscript={draft.general ? "I noticed something unusual near the water." : draft.value === "absent" ? "I did not see any foam at this site." : "I can see foam floating on the water at this site."} onBusyChange={setVoiceBusy} onTranscript={text => { update({ text }); setTranscriptionLabel(simulated ? "Simulated transcription, please check" : "AI transcription, please check"); }}/>
        {transcriptionLabel && <p className="ai-badge">{transcriptionLabel}</p>}
        <button disabled={voiceBusy || draft.general && !draft.text.trim()} onClick={() => void guide()}>Check my report</button></>}
      {step === "guide" && <><h1>Check the observation context</h1><p>Answer what you know. Unknown answers stay visible for the researcher.</p><div role="status" aria-live="polite" aria-atomic="true">{helping ? "Checking your report..." : <><p>Context round {round + 1} of 2</p><span className="sr-only">{questions.map(q => `${q.text} Choices: ${q.options.join(", ")}.`).join(" ")}</span></>}</div>{!helping && questions.map((q, i) => <fieldset key={`${round}-${q.field}`}><legend>{q.text}</legend><div className="clarification-chips">{q.options.map(option => <button key={option} aria-pressed={replies[i] === option} onClick={() => setReplies(r => ({ ...r, [i]: option }))}>{option}</button>)}</div></fieldset>)}{!helping && questions.length > 0 && <button disabled={questions.some((_, i) => !replies[i])} onClick={answerRound}>Continue context</button>}</>}
      {step === "confirm" && <><span className="ai-badge">{draft.source === "ai_draft" ? "AI draft, please check" : "Report summary, please check"}</span><h1>Is this what you observed?</h1>{data && <label>Site<select value={draft.site} onChange={e => update({ site: e.target.value, distance: undefined })}>{draft.general && <option value="">No site selected</option>}{data.sites.map(s => <option key={s.code} value={s.code}>{s.code}</option>)}</select></label>}<p><strong>{draft.general ? "General inbox" : signalLabels[draft.signal]}</strong>{draft.general ? ": not linked to a case." : `: ${valueLabels[draft.value].toLowerCase()}.`}</p>{!draft.general && <label>Observation<select value={draft.value} onChange={e => { update({ value: e.target.value as CitizenDraft["value"], assumptions: { ...emptyAssumptions } }); setQuestions([]); answers.current = []; if (e.target.value === "absent") { setRound(0); setStep("description"); } }}>{Object.entries(valueLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>}<label>Notes<textarea maxLength={500} value={draft.text} onChange={e => update({ text: e.target.value })}/></label>{draft.value === "absent" && !draft.general && <dl className="summary-context">{(Object.keys(contextLabels) as (keyof Assumptions)[]).map(key => <div key={key}><dt>{contextLabels[key]}</dt><dd>{contextText(draft.assumptions[key])}</dd></div>)}</dl>}<label className="citizen-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I confirm this summary matches my observation.</label><button disabled={!confirmed || draft.general && !draft.text.trim()} onClick={() => setStep("submit")}>Continue to submit</button></>}
      {step === "submit" && <><h1>Ready for researcher review</h1><p>{draft.general ? "This general-inbox report is not linked to a case and never changes candidates." : `Site ${draft.site}: ${signalLabels[draft.signal]}, ${valueLabels[draft.value].toLowerCase()}.`}</p><p>A researcher will review this report.</p><button disabled={!confirmed || saving} onClick={() => void submit()}>{saving ? "Submitting..." : "Submit report"}</button></>}
    </section>
    {step !== "where" && <button className="citizen-back" disabled={saving || helping || voiceBusy} onClick={() => { helpVersion.current++; setConfirmed(false); setStep(step === "value" ? "where" : step === "description" ? draft.general ? "where" : "value" : step === "guide" || step === "confirm" ? "description" : "confirm"); }}>Back</button>}
  </CitizenFrame>;
}
