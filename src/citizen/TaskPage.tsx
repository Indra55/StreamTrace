import { useEffect, useState } from "react";
import { ApiError, request, casesSchema } from "../api.ts";
import { CitizenFrame, demoMode, setDemoMode, Link } from "./navigation.tsx";
import { demoTask } from "./demo-store.ts";
import { taskSchema } from "./model.ts";
import { z } from "zod";
export default function TaskPage() {
  const [caseName, setCaseName] = useState(""), [caseId, setCaseId] = useState(""), [simulated, setSimulated] = useState(demoMode);
  const [task, setTask] = useState<z.infer<typeof taskSchema> | null>(null), [message, setMessage] = useState("Loading the next field task..."), [copied, setCopied] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    async function load() {
      setTask(null); setUnavailable(false);
      if (simulated) {
        const template = demoTask(); setCaseName("Foam investigation");
        if (!template) { setMessage("No task yet. A researcher needs to review evidence first."); return; }
        setCaseId(template.case_id);
        const local = { site: template.site_code, text_en: [template.instruction, template.safety, template.reason].join(" "), source: "template" as const,
          facts: { total: template.facts.candidate_count, seen_leaves: template.facts.present_count, not_seen_leaves: template.facts.absent_count }, model: null, prompt_version: "task-v2-1" as const, latency_ms: 0 };
        // The local engine chooses the simulated task. The API only phrases its facts.
        try {
          const result = taskSchema.parse(await request("/api/demo/task", { method: "POST", body: JSON.stringify({ site: local.site, signal: template.signal, facts: local.facts }), signal: controller.signal }));
          if (result.site !== local.site || result.facts.total !== local.facts.total || result.facts.seen_leaves !== local.facts.seen_leaves || result.facts.not_seen_leaves !== local.facts.not_seen_leaves) throw new Error("Task facts mismatch");
          if (active) { setTask(result); setMessage(""); }
        } catch { if (active) { setTask(local); setMessage("Automatic wording unavailable. Showing the standard simulated instruction."); } }
        return;
      }
      try {
        const rows = casesSchema.parse(await request("/api/cases", { signal: controller.signal })).filter(c => !c.simulated);
        const requested = new URLSearchParams(location.search).get("case"), selected = rows.find(c => c.id === requested) ?? rows[0];
        if (!active) return;
        if (!selected || requested && selected.id !== requested) { setMessage("No task yet. A researcher needs to review evidence first."); setUnavailable(true); return; }
        setCaseName(selected.title ?? `${selected.signal} investigation`); setCaseId(selected.id);
        const result = taskSchema.parse(await request("/api/task", { method: "POST", body: JSON.stringify({ case_id: selected.id }), signal: controller.signal }));
        if (active) { setTask(result); setMessage(""); }
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 409) setMessage(error.message);
        else { setMessage("A field task could not be loaded. Please try again later."); setUnavailable(true); }
      }
    }
    void load(); return () => { active = false; controller.abort(); };
  }, [simulated]);
  return <CitizenFrame simulated={simulated} taskWording>
    <p className="eyebrow">Next field task</p>{caseName && <p className="current-investigation">Current investigation: <strong>{caseName}</strong></p>}
    <h1>{task ? `Check site ${task.site}` : "Field guide"}</h1>
    {task ? <section className="citizen-card">
      <span className="ai-badge">{task.source === "ai" ? "AI-written from engine facts" : "Standard instruction"}</span>
      <h2>What to look for</h2><p>{task.text_en}</p>{message && <p role="status">{message}</p>}
      <dl className="task-facts"><dt>Candidate reaches</dt><dd>{task.facts.total}</dd><dt>If seen</dt><dd>{task.facts.seen_leaves} candidates remain</dd><dt>If not seen</dt><dd>{task.facts.not_seen_leaves} candidates remain</dd></dl>
      <Link className="citizen-button" href={`/report?mode=${simulated ? "demo" : "live"}&site=${encodeURIComponent(task.site)}&case=${encodeURIComponent(caseId)}`}>Report from this site</Link>
      <button onClick={async () => { try { await navigator.clipboard.writeText(task.text_en); setCopied("Task text copied."); } catch { setCopied("Copy unavailable. Select the text below to copy it."); } }}>Copy text</button>
      <p role="status">{copied}</p>{copied.startsWith("Copy unavailable") && <textarea aria-label="Task text to copy" readOnly value={task.text_en}/>}
    </section> : <><p role="status">{message}</p>{unavailable && !simulated && <button onClick={() => { setSimulated(true); setDemoMode(true); }}>Try a simulated task</button>}</>}
  </CitizenFrame>;
}
