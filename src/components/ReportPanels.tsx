import { valueLabels } from "../citizen/model.ts";
import type { Value } from "../../engine/index.ts";
import { contextLabels, contextText, type Assumptions } from "../../shared/observations.ts";
export function ObservationText({text, onChange, disabled=false, optional=false}: {text:string;onChange:(text:string)=>void;disabled?:boolean;optional?:boolean}) {
  return <><label>Describe it in your own words <span>{optional ? "(optional)" : ""}</span><textarea maxLength={500} disabled={disabled} value={text} onChange={e=>onChange(e.target.value)}/></label><small>{text.length} / 500 characters</small></>;
}
export function ObservationChoice({value,onChange}: {value:Value;onChange:(value:Value)=>void}) {
  return <div className="citizen-options">{Object.entries(valueLabels).map(([v,label])=><button key={v} aria-pressed={value===v} onClick={()=>onChange(v as Value)}>{label}</button>)}</div>;
}
export function ContextSummary({answers}: {answers:Assumptions}) {
  return <dl>{Object.entries(contextLabels).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{contextText(answers[key as keyof Assumptions])}</dd></div>)}</dl>;
}
