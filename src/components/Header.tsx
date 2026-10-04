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
      <Link className="wordmark" href="/" aria-label="StreamTrace">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{width: "24px", height: "24px", color: "var(--river)"}}>
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
        </svg>
        StreamTrace
      </Link>
      {mode && <span className={`mode-chip ${path === "/review" ? "mode-live" : ""}`}>{mode}</span>}
      <button ref={menu} className="menu-toggle" aria-expanded={open} aria-controls="site-navigation" onClick={() => setOpen(value => !value)}>Menu</button>
      <nav id="site-navigation" className={`site-navigation${open ? " is-open" : ""}`} aria-label="Main navigation">
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/docs" aria-current={path === "/docs" ? "page" : undefined}>Project guide</Link>
        <Link href="/demo" aria-current={path === "/demo" ? "page" : undefined}>Demo</Link>
        <Link className="sign-in-link" href="/workflow" aria-current={path === "/workflow" ? "page" : undefined} onClick={() => setDemoMode(false)}>Live Portal</Link>
      </nav>
    </header>
  </>;
}
