import SitePicker from "../citizen/SitePicker.tsx";
import VoiceInput from "../citizen/VoiceInput.tsx";
import { ObservationText, ObservationChoice, ContextSummary } from "../components/ReportPanels.tsx";
import type { Network } from "../demo.ts";
import { fallbackLabel } from "./ai.ts";
import type { FormState } from "./model.ts";
export function MissionReport({form,data,onChange,onExample,onAssistant,onAnswers,onSubmit}: {form:FormState;data:Network;onChange:(patch:Partial<FormState>)=>void;onExample:()=>void;onAssistant:(regenerate?:boolean)=>void;onAnswers:()=>void;onSubmit:()=>void}) {
  const draft=form.drafts.at(-1),questions=form.round<2?draft?.questions??[]:[];
  return <section id="report-text" className="mission-report" aria-busy={form.busy}>
    <p className="eyebrow">Foam observation / simulated</p>
    <details><summary>Observation site: {form.site} (change)</summary><SitePicker data={{...data,sites:data.sites.filter(s=>s.accessible)}} value={form.site} onChange={site=>onChange({site})} allowLocation={false}/></details>
    <ObservationChoice value={form.value} onChange={value=>onChange({value})}/>
    {form.value==="cannot_tell"&&<p className="mission-uncertain-note" role="status">{draft?.value==="cannot_tell" ? "The assistant could not identify a clear Seen or Not seen observation. Check the text and selection before submitting." : "Cannot tell reports are kept as uncertain and do not narrow the search."}</p>}
    <p className="mission-privacy">AI privacy: report text and context answers may be sent to the AI service for drafting. Do not include names, phone numbers or personal details. Coordinates are never sent.</p>
    <ObservationText text={form.text} onChange={text=>onChange({text})} disabled={form.busy}/>
    <div className="mission-actions"><button data-action="example" onClick={onExample} disabled={form.busy}>Use example observation</button><VoiceInput onBusyChange={busy=>onChange({busy})} onTranscript={text=>onChange({text})}/></div>
    <button data-action="assistant" disabled={form.busy||!form.text.trim()} onClick={()=>onAssistant()}>Ask the assistant</button>
    {form.busy&&<p role="status">Drafting your observation…</p>}
    {draft&&<><p className="ai-badge">{draft.source==="ai"?"Live AI draft":fallbackLabel}</p><p>{draft.rationale_en}</p><p>Draft is editable above. Your confirmation does not approve evidence.</p><ContextSummary answers={form.assumptions}/>
      {questions.length>0&&<div className="mission-questions"><p>Context round {form.round+1} of 2</p>{questions.map(q=><fieldset key={q.id}><legend>{q.text}</legend>{q.options.map(option=><button key={option} disabled={form.busy} aria-pressed={form.replies[q.id]===option} onClick={()=>onChange({replies:{...form.replies,[q.id]:option}})}>{option}</button>)}</fieldset>)}<button data-action="example-answers" disabled={form.busy} onClick={()=>onChange({replies:Object.fromEntries(questions.map(q=>[q.id,"Unknown"]))})}>Use example answers (Unknown)</button><button data-action="answers" disabled={form.busy||questions.some(q=>!form.replies[q.id])} onClick={onAnswers}>Submit context answers</button></div>}
      <button disabled={form.busy} onClick={()=>onAssistant(true)}>Regenerate draft</button>
    </>}
    <label className="mission-confirm"><input data-action="confirm" type="checkbox" checked={form.confirmed} disabled={form.busy} onChange={e=>onChange({confirmed:e.target.checked})}/>I confirm this is the observation I want to submit.</label>
    <button data-action="submit" disabled={!form.confirmed||form.busy||!form.text.trim()||!form.site} onClick={onSubmit}>Submit simulated report</button>
  </section>;
}
