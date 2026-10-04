import { z } from "zod";

export const signalSchema = z.enum(["colour", "foam", "discharge", "litter", "dead_fish", "other"]);
export const signalLabels: Record<z.infer<typeof signalSchema>, string> = { colour: "Colour", foam: "Foam", discharge: "Discharge", litter: "Litter", dead_fish: "Dead fish", other: "Something else" };
export function caseTitle(c: { title?: string; signal: string }) { return c.title || `${signalLabels[c.signal as keyof typeof signalLabels] ?? c.signal.replaceAll("_", " ")} investigation`; }
export const assumptionsSchema = z.object({ persistence: z.boolean().nullable(), detectability: z.boolean().nullable(), flow: z.boolean().nullable(), recent_rain: z.enum(["yes", "no", "cannot_tell"]) }).strict();
export type Assumptions = z.infer<typeof assumptionsSchema>;
export const emptyAssumptions: Assumptions = { persistence: null, detectability: null, flow: null, recent_rain: "cannot_tell" };
export const contextLabels = { persistence: "Persistence", detectability: "Detectability", flow: "Flow", recent_rain: "Recent rain" };
export type ContextKey = keyof Assumptions;
export function unknownContext(answers?: Partial<Assumptions>) {
  return (Object.keys(contextLabels) as ContextKey[]).filter(key => key === "recent_rain" ? !answers?.[key] || answers[key] === "cannot_tell" : answers?.[key] === null || answers?.[key] === undefined);
}
export function contextText(value: Assumptions[ContextKey] | undefined) { return value === true || value === "yes" ? "Yes" : value === false || value === "no" ? "No" : "Unknown"; }
export const contextQuestions: Record<ContextKey, string> = { persistence: "Did the signal persist while you watched?", detectability: "Was the signal clearly detectable from a safe place?", flow: "Could you tell which way the water was flowing?", recent_rain: "Has there been recent rain?" };
export type GuideQuestion = { field: ContextKey | "value"; text: string; options: string[] };
export function guideQuestions(value: string, answers: Assumptions, answered: readonly string[] = []): GuideQuestion[] {
  if (value === "present") return [];
  if (value === "cannot_tell") return answered.includes("value") ? [] : [{ field: "value", text: "Can you clearly see the signal from a safe place?", options: ["Seen", "Not seen", "Cannot tell"] }];
  return unknownContext(answers).filter(key => !answered.includes(key)).slice(0, 2).map(field => ({ field, text: contextQuestions[field], options: ["Yes", "No", "Unknown"] }));
}
export const referenceAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const referenceSchema = z.string().regex(new RegExp(`^[${referenceAlphabet}]{16}$`));
