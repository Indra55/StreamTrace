import { z } from "zod";

export class BudgetError extends Error {
  constructor() { super("budget"); }
}
/** Counts actual outbound attempts, including retries. Shared by both features. */
export class AiBudget {
  private day = "";
  private used = 0;
  private reset(now: number) {
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== this.day) { this.day = day; this.used = 0; }
  }
  exhausted(limit: number, now = Date.now()) { this.reset(now); return this.used >= limit; }
  claim(limit: number, now = Date.now()) {
    if (this.exhausted(limit, now)) throw new BudgetError();
    this.used++;
  }
}
export const dailyBudget = new AiBudget();
export interface AiOptions {
  budget?: AiBudget;
  dailyLimit?: number;
  timeoutMs?: number;
}
const envelope = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string().max(16_384) }) })).min(1) });

/** A single five-second deadline covers at most two attempts and response parsing. */
export async function groqJson(system: string, data: unknown, key: string, model: string,
  fetcher: typeof fetch = fetch, options: AiOptions = {}): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const operation = async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      (options.budget ?? dailyBudget).claim(options.dailyLimit ?? 200);
      let response: Response;
      try {
        response = await fetcher("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST", signal: controller.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, max_tokens: 650,
            messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(data) }] }),
        });
        if (!response.ok) throw new Error("Provider unavailable");
      } catch (error) {
        if (controller.signal.aborted || attempt === 1) throw error;
        continue;
      }
      // Schema or JSON failures are not retried.
      const result = envelope.parse(await response.json());
      return JSON.parse(result.choices[0]!.message.content) as unknown;
    }
    throw new Error("Provider unavailable");
  };
  try {
    return await Promise.race([operation(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Provider timeout")); }, options.timeoutMs ?? 5_000);
    })]);
  } finally { if (timer) clearTimeout(timer); controller.abort(); }
}

export { aiSignal, signalTerms, normalized, causeOrChemical, instructions, type AiSignal } from "../shared/ai.ts";
