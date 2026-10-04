import { useEffect, useRef, useState } from "react";
import { Link, setDemoMode } from "../citizen/navigation.tsx";

export function Header({ path, route }: { path: string; route: string }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [route]);
  const mode = path === "/review" ? "Live" : path === "/demo" ? "Demo (simulated)" : null;
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="masthead site-header" onKeyDown={event => {
      if (event.key === "Escape" && open) { setOpen(false); menu.current?.focus(); }
    }}>
      <Link className="wordmark" href="/" aria-label="StreamTrace">StreamTrace<span>Field atlas / Coimbra</span></Link>
      {mode && <span className={`mode-chip ${path === "/review" ? "mode-live" : ""}`}>{mode}</span>}
      <button ref={menu} className="menu-toggle" aria-expanded={open} aria-controls="site-navigation" onClick={() => setOpen(value => !value)}>Menu</button>
      <nav id="site-navigation" className={`site-navigation${open ? " is-open" : ""}`} aria-label="Main navigation">
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/report" aria-current={path === "/report" ? "page" : undefined} onClick={() => setDemoMode(false)}>Report</Link>
        <Link href="/demo" aria-current={path === "/demo" ? "page" : undefined}>Demo</Link>
        <Link className="sign-in-link" href="/login" aria-current={path === "/login" ? "page" : undefined}>Reviewer sign in</Link>
      </nav>
    </header>
  </>;
}
