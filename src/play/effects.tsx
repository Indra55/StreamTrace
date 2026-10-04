import { useEffect, useRef, useState } from "react";

/**
 * Organic foam particle system.
 * Three depth layers of clustered soft shapes drift through a water current,
 * backed by slow caustic light patterns and a waterline shimmer.
 */
export function River({ reduced }: { reduced: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reduced) return;
    const el = canvas.current, ctx = el?.getContext("2d");
    if (!el || !ctx) return;

    /* Seeded PRNG — consistent visuals across renders */
    let seed = 42;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    /* ── Foam patches: organic blob clusters ── */
    const foam = Array.from({ length: 22 }, (_, i) => {
      const layer = i < 6 ? 0 : i < 15 ? 1 : 2; // far, mid, near
      const base = layer === 0 ? 14 + rng() * 18 : layer === 1 ? 26 + rng() * 38 : 50 + rng() * 55;
      return {
        x: rng(), y: rng(),
        blobs: Array.from({ length: 2 + Math.floor(rng() * 3) }, () => ({
          dx: (rng() - 0.5) * base * 0.65,
          dy: (rng() - 0.5) * base * 0.45,
          r: base * (0.26 + rng() * 0.34),
        })),
        drift: (layer === 0 ? 13 : layer === 1 ? 8 : 3.5) + rng() * 5,
        rise: 1 + rng() * 2.5,
        wF: 0.35 + rng() * 1.1, wA: 8 + rng() * 16,
        phase: rng() * 12000,
        layer, base,
        alpha: layer === 0 ? 0.14 + rng() * 0.1 : layer === 1 ? 0.22 + rng() * 0.2 : 0.09 + rng() * 0.07,
        tint: i % 3,
      };
    });

    /* ── Atmospheric specks ── */
    const specks = Array.from({ length: 38 }, () => ({
      x: rng(), y: rng(), r: 1 + rng() * 2.4,
      drift: 3 + rng() * 7, rise: 0.4 + rng() * 1.8,
      phase: rng() * 14000, alpha: 0.07 + rng() * 0.12,
    }));

    /* ── Caustic light patterns ── */
    const caustics = Array.from({ length: 3 }, () => ({
      x: rng(), y: 0.2 + rng() * 0.6,
      rx: 220 + rng() * 340, ry: 160 + rng() * 220,
      rot: rng() * Math.PI * 2, rotV: (rng() - 0.5) * 0.00022,
      driftX: (rng() - 0.5) * 2.2,
      alpha: 0.018 + rng() * 0.024, phase: rng() * 8000,
    }));

    const tints: [number, number, number][] = [
      [252, 250, 242], // warm white
      [190, 210, 198], // sage
      [238, 230, 214], // golden cream
    ];

    let frame = 0, last = 0, time = 0;

    const draw = (now: number) => {
      const dt = last ? Math.min(now - last, 50) : 16;
      last = now; time += dt;

      const w = el.clientWidth, h = el.clientHeight;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (el.width !== pw || el.height !== ph) { el.width = pw; el.height = ph; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const fi = Math.min(1, time / 2500);   // global fade-in
      const sc = w < 600 ? 0.55 : 1;          // mobile scale

      /* ── 1. Caustic light layer ── */
      for (const c of caustics) {
        const t = (time + c.phase) / 1000;
        const cx = (c.x * w + c.driftX * t) % (w + 500) - 250;
        const cy = c.y * h + Math.sin(t * 0.18) * 22;
        ctx.save();
        ctx.globalAlpha = c.alpha * fi;
        ctx.translate(cx, cy);
        ctx.rotate(c.rot + c.rotV * time);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(c.rx, c.ry) * sc);
        g.addColorStop(0, "rgba(255,255,245,0.45)");
        g.addColorStop(0.55, "rgba(255,255,245,0.12)");
        g.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.ellipse(0, 0, c.rx * sc, c.ry * sc, 0, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        ctx.restore();
      }

      /* ── 2. Specks ── */
      for (const sp of specks) {
        const t = (time + sp.phase) / 1000;
        const x = ((sp.x * w + sp.drift * t) % (w + 30)) - 15;
        const y = ((sp.y * h - sp.rise * t) % (h + 30) + h + 30) % (h + 30) - 15;
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + sp.phase * 0.01);
        ctx.save();
        ctx.globalAlpha = sp.alpha * fi * pulse;
        ctx.beginPath();
        ctx.arc(x, y, sp.r * sc, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(192,187,175,0.85)";
        ctx.fill();
        ctx.restore();
      }

      /* ── 3. Foam patches (far → near) ── */
      const sorted = [...foam].sort((a, b) => a.layer - b.layer);
      for (const p of sorted) {
        const t = (time + p.phase) / 1000;
        const tw = w + p.base * 5, th = h + p.base * 5;
        const px = ((p.x * w + p.drift * t) % tw + tw) % tw - p.base * 2.5;
        const py = ((p.y * h - p.rise * t) % th + th) % th - p.base * 2.5
          + Math.sin(t * p.wF) * p.wA;

        if (px < -p.base * 3 || px > w + p.base * 3 ||
            py < -p.base * 3 || py > h + p.base * 3) continue;

        const [tr, tg, tb] = tints[p.tint]!;
        ctx.save();
        ctx.globalAlpha = p.alpha * fi;

        // Soft shadow
        for (const b of p.blobs) {
          const bx = px + b.dx * sc, by = py + b.dy * sc + 5 * sc;
          const br = b.r * sc * 1.08;
          const sh = ctx.createRadialGradient(bx, by, 0, bx, by, br);
          sh.addColorStop(0, "rgba(36,52,59,0.035)");
          sh.addColorStop(1, "transparent");
          ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fillStyle = sh; ctx.fill();
        }

        // Main blobs
        for (const b of p.blobs) {
          const bx = px + b.dx * sc, by = py + b.dy * sc, br = b.r * sc;
          const g = ctx.createRadialGradient(
            bx - br * 0.2, by - br * 0.22, br * 0.04,
            bx, by, br,
          );
          g.addColorStop(0, `rgba(${tr},${tg},${tb},0.65)`);
          g.addColorStop(0.35, `rgba(${tr},${tg},${tb},0.3)`);
          g.addColorStop(0.72, `rgba(${tr},${tg},${tb},0.08)`);
          g.addColorStop(1, "transparent");
          ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fillStyle = g; ctx.fill();
        }

        // Highlight on largest blob
        const big = p.blobs.reduce((a, b) => b.r > a.r ? b : a);
        const hx = px + big.dx * sc - big.r * sc * 0.18;
        const hy = py + big.dy * sc - big.r * sc * 0.2;
        const hr = big.r * sc * 0.16;
        const hl = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
        hl.addColorStop(0, "rgba(255,255,255,0.75)");
        hl.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2);
        ctx.fillStyle = hl; ctx.fill();

        ctx.restore();
      }

      /* ── 4. Waterline shimmer ── */
      const waveBase = h * 0.86;
      ctx.save();
      ctx.globalAlpha = 0.04 * fi;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const y = waveBase
          + Math.sin(x * 0.007 + time * 0.0008) * 14
          + Math.sin(x * 0.013 - time * 0.0006) * 7;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const wg = ctx.createLinearGradient(0, waveBase, 0, h);
      wg.addColorStop(0, "rgba(36,91,131,0.22)");
      wg.addColorStop(0.5, "rgba(159,189,178,0.16)");
      wg.addColorStop(1, "rgba(228,223,212,0.08)");
      ctx.fillStyle = wg; ctx.fill();
      ctx.restore();

      frame = requestAnimationFrame(draw);
    };

    const vis = () => {
      cancelAnimationFrame(frame); last = 0;
      if (!document.hidden) frame = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", vis);
    vis();
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", vis); };
  }, [reduced]);

  return (
    <div className="foam-field" aria-hidden="true">
      {reduced ? <div className="foam-still" /> : <canvas ref={canvas} />}
    </div>
  );
}

export function Count({ value, reduced }: { value: number; reduced: boolean }) {
  const [display, setDisplay] = useState(value), previous = useRef(value);
  useEffect(() => {
    if (reduced) { previous.current = value; setDisplay(value); return; }
    const start = performance.now(), from = previous.current;
    let frame = 0;
    const draw = (now: number) => {
      const p = Math.min(1, (now - start) / 650);
      setDisplay(Math.round(from + (value - from) * p));
      if (p < 1) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    previous.current = value;
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <strong aria-label={`${value} candidate reaches`}>{display}</strong>;
}

export function useSound() {
  const context = useRef<AudioContext | null>(null), [enabled, setEnabled] = useState(false);
  useEffect(() => () => { void context.current?.close(); }, []);
  function toggle() {
    if (enabled) { setEnabled(false); void context.current?.suspend(); }
    else { context.current ??= new AudioContext(); void context.current.resume(); setEnabled(true); }
  }
  function ping() {
    if (!enabled || !context.current) return;
    const audio = context.current, osc = audio.createOscillator(), gain = audio.createGain();
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(.025, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .2);
    osc.connect(gain).connect(audio.destination);
    osc.start(); osc.stop(audio.currentTime + .2);
  }
  return { enabled, toggle, ping };
}
