import { z } from "zod";

export const aiSignal = z.enum(["colour", "foam", "discharge", "litter", "dead_fish"]);
export type AiSignal = z.infer<typeof aiSignal>;
export const signalTerms: Record<AiSignal, RegExp> = {
  colour: /\b(?:colou?r|discolou?ration|brown|green|red|orange|muddy|cor|coloracao|castanh[ao]|verde|vermelh[ao]|turva|barrenta)\b/i,
  foam: /\b(?:foam|foamy|froth|espuma)\b/i,
  discharge: /\b(?:discharge|outfall|pipe|descarga|tubo|cano)\b/i,
  litter: /\b(?:litter|rubbish|trash|garbage|plastic|bottles?|bags?|lixo|plastico|garrafas?|sacos?)\b/i,
  dead_fish: /\b(?:dead fish|fish (?:are |were )?dead|peixes? mortos?|peixes? (?:estao |estava[m]? )?mortos?)\b/i,
};
export function normalized(text: string) { return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
export const causeOrChemical = /\b(?:chemicals?|detergents?|pesticides?|fertili[sz]ers?|sewage|pollut\w*|contamin\w*|toxic\w*|poison\w*|caus\w*|because|due to|factory|industrial|chlorine|chloride|nitrates?|phosphates?|mercury|arsenic|ammonia|bleach|petrol|gasoline|diesel|oil|solvent\w*|acid\w*|alkali\w*|lead|copper|cadmium|quimic\w*|detergente\w*|pesticida\w*|esgoto|fabrica|por causa|devido a|porque|cloro|nitrato\w*|mercurio|amonia|veneno|oleo)\b/i;
export const instructions = /\b(?:ignore|disregard|forget|override|system|developer|assistant|prompt|instructions?|instrucoes|ignora\w*|sistema|return|output|respond|responda|retorne|approve|approved|review_state|aprov\w*|pretend|execute|reveal|set\s+\w+|classify\s+as|mark\s+as)\b|<\/?(?:system|assistant)|```/i;

export const DRAFT_PROMPT_VERSION = "draft-v2-1";
const answer = z.enum(["yes", "no", "unknown"]);
export const valueSchema = z.enum(["present", "absent", "cannot_tell"]);
export const draftInputSchema = z.object({
  text: z.string().trim().min(1).max(500), siteHint: z.string().max(80).optional(), signal: aiSignal,
  answers: z.object({ persistence: answer.optional(), detectability: answer.optional(), flow: answer.optional(), recent_rain: answer.optional() }).strict().optional(),
  round: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
}).strict();
export const assumptionSchema = z.object({ persistence: answer, detectability: answer, flow_conditions: answer, recent_rain: answer }).strict();
const questionSchema = z.object({ id: z.enum(["persistence", "detectability", "flow", "recent_rain"]), text: z.string().max(200), options: z.array(z.string().max(80)).min(2).max(4) }).strict();
export const draftOutputSchema = z.object({
  status: z.enum(["complete", "needs_clarification", "fallback"]), signal: aiSignal, value: valueSchema,
  confidence: z.number().finite().min(0).max(1), site_hint: z.string().max(80).nullable(), assumptions: assumptionSchema,
  questions: z.array(questionSchema).max(2), flags: z.array(z.string().max(100)).max(8), rationale_en: z.string().max(500),
  detected_language: z.enum(["en", "pt", "unknown"]), source: z.enum(["ai", "fallback"]),
  model: z.string().nullable(), prompt_version: z.literal(DRAFT_PROMPT_VERSION), latency_ms: z.number().nonnegative(),
}).strict();
export type DraftInput = z.infer<typeof draftInputSchema>;
export type Draft = z.infer<typeof draftOutputSchema>;
type Assumptions = Draft["assumptions"];
const unknowns: Assumptions = { persistence: "unknown", detectability: "unknown", flow_conditions: "unknown", recent_rain: "unknown" };
const questionText = {
  persistence: "Would this signal still be visible after 10 minutes, or is that unknown?",
  detectability: "Can you distinguish the signal here, or does a nearby weir or waterfall make it hard to tell?",
  flow: "Is the stream flow normal for this location, or is that unknown?",
  recent_rain: "Has it rained here in the last 24 hours, or is that unknown?",
};
// Detectability answers describe whether the signal is distinguishable, not whether a weir exists.
const questionOptions = {
  persistence: ["Yes", "No", "Unknown"],
  detectability: ["Yes, distinguishable", "No, a weir or waterfall makes it hard to tell", "Unknown"],
  flow: ["Yes, normal flow", "No, unusual flow", "Unknown"],
  recent_rain: ["Yes", "No", "Unknown"],
};
export function clarificationQuestions(value: Draft["value"], assumptions: Assumptions, round: number, answers?: DraftInput["answers"]): Draft["questions"] {
  if (value !== "absent" || round >= 2) return [];
  const keys = ["persistence", "detectability", "flow", "recent_rain"] as const;
  // Each round has its own pair. An explicit Unknown reply must not be asked again.
  const remaining = round > 0 && !answers ? keys.slice(2) : keys.filter(id => round === 0 || answers?.[id] === undefined);
  return remaining.filter(id => assumptions[id === "flow" ? "flow_conditions" : id] === "unknown").slice(0, 2)
    .map(id => ({ id, text: questionText[id], options: questionOptions[id] }));
}
function context(text: string): Assumptions {
  const a = { ...unknowns };
  if (/\b(?:lasts?|persist\w*|still (?:there|visible))\b.{0,25}\b(?:10|ten) minutes?\b|\b(?:10|dez) minutos\b.{0,25}\b(?:ainda|visivel|persiste)\b/.test(text)) a.persistence = "yes";
  if (/\b(?:gone|disappear\w*|not visible)\b.{0,25}\b(?:10|ten) minutes?\b/.test(text)) a.persistence = "no";
  if (/\b(?:clearly (?:visible|detectable)|easy to distinguish|claramente visivel)\b/.test(text)) a.detectability = "yes";
  if (/\b(?:hard to distinguish|not detectable|weir|waterfall|acude|cascata)\b/.test(text)) a.detectability = "no";
  if (/\b(?:normal flow|flow is normal|caudal normal)\b/.test(text)) a.flow_conditions = "yes";
  if (/\b(?:unusual flow|high flow|low flow|flow is (?:high|low)|caudal (?:alto|baixo))\b/.test(text)) a.flow_conditions = "no";
  if (/\b(?:no rain|has not rained|hasn't rained|nao choveu)\b.{0,30}\b(?:24 hours|24 horas|day)\b/.test(text)) a.recent_rain = "no";
  else if (/\b(?:rained|rain|choveu|chuva)\b.{0,30}\b(?:last 24 hours|past 24 hours|ultimas 24 horas|today|hoje)\b/.test(text)) a.recent_rain = "yes";
  return a;
}
function classify(text: string, signal: Draft["signal"]): Draft["value"] {
  const sentences = text.split(/[.!?;\n]+/).filter(s => signalTerms[signal].test(s));
  if (!sentences.length) return "cannot_tell";
  let present = false, absent = false;
  for (const sentence of sentences) {
    if (/\b(?:maybe|perhaps|might|possibly|unsure|uncertain|not sure|cannot tell|can't tell|could not tell|couldn't tell|hard to tell|talvez|nao sei|nao consigo|nao tenho certeza|parece|pode ser|if|would|yesterday|ontem)\b/.test(sentence)) return "cannot_tell";
    if (/\b(?:no|not|none|without|haven't|didn't|don't|cannot see|can't see|nao|sem|nenhum\w*)\b/.test(sentence)) absent = true;
    else if (/\b(?:see|saw|seen|seeing|visible|observed|notice|there is|there are|there's|there're|is present|are present|vejo|vi|visivel|ha|esta|estao|observo)\b/.test(sentence)) present = true;
  }
  return present === absent ? "cannot_tell" : present ? "present" : "absent";
}
/** Deliberately conservative: a flagged text is ignored in its entirety. */
export function parseDraft(input: DraftInput): Omit<Draft, "status" | "source" | "model" | "prompt_version" | "latency_ms" | "questions"> {
  const text = normalized(input.text), flags: string[] = [];
  if (causeOrChemical.test(text) || causeOrChemical.test(normalized(input.siteHint ?? ""))) flags.push("text asserted a cause or chemical: ignored");
  if (instructions.test(text) || instructions.test(normalized(input.siteHint ?? ""))) flags.push("text contained instructions: ignored");
  const other = Object.entries(signalTerms).some(([signal, pattern]) => signal !== input.signal && pattern.test(text));
  if (other) flags.push("text described another signal: ignored");
  if (!signalTerms[input.signal].test(text)) flags.push("no case signal observation found");
  const blocked = flags.length > 0;
  const assumptions = blocked ? { ...unknowns } : context(text);
  if (!blocked && input.answers) {
    for (const field of ["persistence", "detectability", "flow", "recent_rain"] as const) {
      const supplied = input.answers[field];
      if (supplied !== undefined) assumptions[field === "flow" ? "flow_conditions" : field] = supplied;
    }
  }
  const value = blocked ? "cannot_tell" : classify(text, input.signal);
  return { signal: input.signal, value, confidence: value === "cannot_tell" ? 0 : 0.75,
    site_hint: !blocked && /^\d{3}$/.test(input.siteHint ?? "") ? input.siteHint! : null,
    assumptions, flags, rationale_en: value === "present" ? "The description reports the case signal as seen." : value === "absent" ? "The description reports the case signal as not seen. Unknown context is preserved." : "The description does not establish a usable observation of the case signal.",
    detected_language: /\b(?:vejo|nao|espuma|lixo|peixe|peixes|chuva|caudal|agua|cor|descarga|vi|ha|esta)\b/.test(text) ? "pt" : /\b(?:i|the|see|foam|water|no|fish|litter|colour|color|discharge)\b/.test(text) ? "en" : "unknown" };
}
export const taskResponseSchema = z.object({ site: z.string(), text_en: z.string().max(1600), source: z.enum(["ai", "template"]),
  facts: z.object({ total: z.number().int().nonnegative(), seen_leaves: z.number().int().nonnegative(), not_seen_leaves: z.number().int().nonnegative() }).strict().refine(f => f.seen_leaves + f.not_seen_leaves === f.total),
  model: z.string().nullable(), prompt_version: z.literal("task-v2-1"), latency_ms: z.number().nonnegative() }).strict();
