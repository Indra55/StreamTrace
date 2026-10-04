import { Link, setDemoMode } from "../citizen/navigation.tsx";
import { OneAquaHealth } from "./OneAquaHealth.tsx";

export function Workflow() {
  return (
    <main id="main-content" tabIndex={-1} style={{ maxWidth: "1000px", margin: "0 auto", padding: "64px 20px" }}>
      <div className="hero-heading" style={{ marginBottom: "50px", textAlign: "center" }}>
        <p className="eyebrow">StreamTrace / Portal</p>
        <h1 id="landing-title">Live System Access</h1>
        <p className="landing-intro" style={{ maxWidth: "600px", margin: "16px auto 0" }}>
          Experience the live system. Citizens collect field evidence, while researchers review reports and plan the investigation.
        </p>
      </div>

      <div className="workflow-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "40px" }}>
        
        <article className="workflow-card citizen-card">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: "32px", height: "32px", color: "var(--river)" }}>
              <path d="M7 3h10v18H7zM10 7h4M10 11h4M10 15h2"/><path d="M4 6h3M17 6h3"/>
            </svg>
            <h2 style={{ fontSize: "1.5rem", margin: 0 }}>Citizen View</h2>
          </div>
          <p style={{ color: "var(--muted)", lineHeight: 1.6, marginBottom: "24px" }}>
            As a community volunteer, you act as the eyes and ears in the field. Report anomalies you find or perform directed tasks.
          </p>
          
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ padding: "20px", border: "1px solid var(--line)", borderRadius: "8px", background: "#fdfcf7", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>Report Observation</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "16px", lineHeight: 1.5 }}>
                See foam, dead fish, or a strange color? Start a new report. No account required.
              </p>
              <Link className="primary-action" href="/report" onClick={() => setDemoMode(false)} style={{ display: "inline-flex", width: "100%", justifyContent: "center" }}>
                Submit a Report
              </Link>
            </div>

            <div style={{ padding: "20px", border: "1px solid var(--line)", borderRadius: "8px", background: "#fdfcf7", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>Perform a Field Task</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "16px", lineHeight: 1.5 }}>
                Received an SMS request? Fulfill a targeted observation at a specific stream site.
              </p>
              <Link className="secondary-action" href="/task" onClick={() => setDemoMode(false)} style={{ display: "inline-flex", width: "100%", justifyContent: "center" }}>
                Open Field Task
              </Link>
            </div>
          </div>
        </article>

        <article className="workflow-card citizen-card">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: "32px", height: "32px", color: "var(--river)" }}>
              <path d="M5 3h14v18H5zM8 8l2 2 5-5M8 14h8M8 17h5"/>
            </svg>
            <h2 style={{ fontSize: "1.5rem", margin: 0 }}>Reviewer View</h2>
          </div>
          <p style={{ color: "var(--muted)", lineHeight: 1.6, marginBottom: "24px" }}>
            As a researcher, you validate incoming reports, apply them to case models, and direct the investigation map.
          </p>
          
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ padding: "20px", border: "1px solid var(--line)", borderRadius: "8px", background: "#fdfcf7", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>Review Dashboard</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "16px", lineHeight: 1.5 }}>
                Check the pending queue, review evidence, and inspect the narrowing source map.
              </p>
              <Link className="primary-action" href="/login" onClick={() => setDemoMode(false)} style={{ display: "inline-flex", width: "100%", justifyContent: "center", background: "#345060", borderColor: "#345060" }}>
                Sign in to Review
              </Link>
            </div>
          </div>
        </article>

      </div>
      <OneAquaHealth/>
    </main>
  );
}
