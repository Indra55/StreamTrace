export function GuidedTour({ complete, conflicting, onStep, onClose }: {
  complete: boolean[];
  conflicting: boolean;
  onStep: (step: number) => void;
  onClose: () => void;
}) {
  const steps = [
    "Read the pending citizen report.",
    "Approve it with the assumptions shown.",
    "Watch the candidate count drop on the map.",
    "Open the recommended next site.",
  ];
  return <details className="guided-tour" onToggle={event => { if (!event.currentTarget.open) onClose(); }}>
    <summary>Guided tour <span>{complete.filter(Boolean).length} of 4 complete</span></summary>
    <p>Choose a step to highlight its control.</p>
    <ol aria-label="Guided tour checklist">
      {steps.map((label, index) => <li key={label}>
        <span className={`tour-check${complete[index] ? " is-complete" : ""}`} aria-hidden="true">{complete[index] ? "✓" : index + 1}</span>
        <button onClick={() => onStep(index)}>{label}<span className="sr-only">{complete[index] ? " Complete" : " Incomplete"}</span></button>
      </li>)}
    </ol>
    <p className="tour-progress" role="status" aria-live="polite">{complete.filter(Boolean).length} of 4 steps complete.</p>
    <button className="optional-tour-step" onClick={() => onStep(4)}>Optional: see what happens when evidence conflicts<span className="sr-only">{conflicting ? " Complete" : " Incomplete"}</span></button>
  </details>;
}
