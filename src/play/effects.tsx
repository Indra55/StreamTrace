import { useCallback, useEffect, useRef, useState } from "react";

/** A short burst of photographic air bubbles across the viewport. */
export const openingBubbles = ["/images/water-bubble.png"];
export const OPENING_DURATION = 2000;
export function River({ reduced, active = false, water }: { reduced: boolean; active?: boolean; water?: () => (() => void) | undefined }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => active && !reduced ? water?.() : undefined, [active, reduced, water]);
  useEffect(() => {
    if (reduced || !active) return;
    const el = canvas.current, ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const sprite = new Image(); sprite.src = openingBubbles[0]!;
    let width = 0, height = 0, frame = 0, last = performance.now(), elapsed = 0, emitted = 0;
    const particles: { x: number; y: number; size: number; speed: number; drift: number; phase: number }[] = [];
    const resize = () => {
      width = innerWidth; height = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      el.width = width * dpr; el.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); window.addEventListener("resize", resize);
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, .05); last = now; elapsed += dt;
      ctx.clearRect(0, 0, width, height);
      // Repeated bursts from three vents, with scattered bubbles between them.
      if (elapsed < .9) {
        const rate = width < 600 ? 240 : 420;
        emitted += dt * rate * (1 + .6 * Math.sin(elapsed * 9));
        while (emitted >= 1 && particles.length < 650) {
          emitted--;
          const vent = [width * .18, width * .51, width * .83][Math.floor(Math.random() * 3)]!;
          const size = 12 + Math.random() ** 2 * 38;
          particles.push({ x: Math.random() < .25 ? Math.random() * width : vent + (Math.random() - .5) * width * .2,
            y: height + size, size, speed: height * (.85 + Math.random() * .65), drift: (Math.random() - .5) * 45, phase: Math.random() * 6.28 });
        }
      }
      ctx.globalAlpha = Math.min(1, Math.max(0, (2 - elapsed) / .25));
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!; p.y -= p.speed * dt; p.x += p.drift * dt;
        if (p.y < -p.size) { particles.splice(i, 1); continue; }
        const x = p.x + Math.sin(elapsed * 3 + p.phase) * 9;
        if (sprite.complete && sprite.naturalWidth) ctx.drawImage(sprite, x - p.size / 2, p.y, p.size, p.size);
      }
      if (elapsed < OPENING_DURATION / 1000) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, [reduced, active]);
  if (reduced || !active) return null;
  return <div className="opening-bubbles" aria-hidden="true">
    <canvas ref={canvas} className="bubble-canvas" />
  </div>;
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
  const context = useRef<AudioContext | null>(null), [enabled, setEnabled] = useState(true);
  const wantsSound = useRef(true);
  useEffect(() => {
    const audio = new AudioContext(); context.current = audio;
    // Try immediately; browsers that block autoplay resume on the first normal interaction.
    const resume = () => { if (wantsSound.current && audio.state === "suspended") void audio.resume().catch(() => undefined); };
    resume();
    document.addEventListener("pointerdown", resume, { capture: true });
    document.addEventListener("keydown", resume, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", resume, { capture: true });
      document.removeEventListener("keydown", resume, { capture: true });
      if (audio.state !== "closed") void audio.close();
    };
  }, []);
  function toggle() {
    wantsSound.current = !enabled;
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
  const water = useCallback(() => {
    if (!enabled || !context.current) return;
    const audio = context.current;
    let cancelled = false, source: AudioBufferSourceNode | undefined;
    const gain = audio.createGain(); gain.gain.value = .75; gain.connect(audio.destination);
    void fetch("/audio/mixkit-ocean-game-movement-water-air-tank-bubbles-huge-long-3017.wav").then(response => {
      if (!response.ok) throw new Error("Water sound unavailable");
      return response.arrayBuffer();
    }).then(buffer => audio.decodeAudioData(buffer)).then(buffer => {
      if (cancelled) return;
      source = audio.createBufferSource(); source.buffer = buffer;
      source.connect(gain); source.start(0, 1, OPENING_DURATION / 1000);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      if (source) { source.stop(); source.disconnect(); }
      gain.disconnect();
    };
  }, [enabled]);
  return { enabled, toggle, ping, water };
}
