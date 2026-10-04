import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { OPENING_DURATION, openingBubbles, River } from "./effects.tsx";

export function Opening({ reduced, sound }: { reduced: boolean; sound?: { enabled: boolean; toggle: () => void; water?: () => (() => void) | undefined } }) {
  const [arrived, setArrived] = useState(reduced);
  const [flowing, setFlowing] = useState(false);
  useEffect(() => {
    if (reduced) { setArrived(true); setFlowing(false); return; }
    let cancelled = false;
    let revealTimer: ReturnType<typeof setTimeout>;
    setArrived(false);
    const images = openingBubbles.map(src => new Promise<void>(resolve => {
      const image = new Image();
      image.onload = image.onerror = () => resolve();
      image.src = src;
    }));
    // Wait for local assets, but never leave the page blurred if loading stalls.
    const fallback = setTimeout(() => { if (!cancelled) setArrived(true); }, OPENING_DURATION);
    void Promise.all(images).then(() => {
      if (cancelled) return;
      clearTimeout(fallback);
      setFlowing(true);
      revealTimer = setTimeout(() => { setArrived(true); setFlowing(false); }, OPENING_DURATION);
    });
    return () => { cancelled = true; clearTimeout(fallback); clearTimeout(revealTimer); };
  }, [reduced]);

  return <section id="opening" className="opening-scene" data-revealed={arrived}>
    <River reduced={reduced} active={flowing} water={sound?.water} />
    <motion.div className="opening-copy"
      initial={reduced ? false : { filter: "blur(16px)", opacity: .45, y: 8 }}
      animate={{ filter: arrived ? "blur(0px)" : "blur(16px)", opacity: arrived ? 1 : .45, y: arrived ? 0 : 8 }}
      transition={{ duration: .25, ease: [0.22, 1, 0.36, 1] }}>
      <span className="story-kicker">A small observation. A bigger picture.</span>
      <h1>our waters are <span className="highlight-scribble">CHANGING.
        <svg className="scribble-svg" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" style={{overflow: 'visible'}}>
          <path d="M0 3 Q25 0 50 3 T100 2 L100 28 Q75 30 50 27 T0 29 Z" fill="currentColor" />
        </svg>
      </span><br /><em>look a little closer.</em></h1>
      <p>In a changing climate, healthy waters mean healthy ecosystems and
        healthy communities. A patch of foam. A change in colour. Dead fish
        that weren't there before. These signals connect water quality to
        the well-being of every living thing downstream.</p>
      <p className="opening-invitation">You notice it. Together, we can follow it - a <strong>One Health</strong> approach to protecting our waterways.</p>
    </motion.div>
  </section>;
}

const steps = [
  { verb: "You notice.", detail: "A citizen sees something unusual and reports what they saw." },
  { verb: "We connect.", detail: "Researchers check the observation and put it in context." },
  { verb: "The search narrows.", detail: "Reviewed evidence helps reveal where to look next." },
  { verb: "Someone looks again.", detail: "One more observation. A clearer picture of the stream." },
];

export function Process({ reduced }: { reduced: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setStep(s => Math.min(s + 1, 3)), 2500);
    return () => clearInterval(timer);
  }, [reduced]);

  return (
    <section id="process" className="process-scene">
      <span className="story-kicker">What we do</span>
      <h1>
        TURN a moment of NOTICING<br />
        into a place to <em>start looking.</em>
      </h1>
      <div className="process-line" aria-label="Report, review, narrow, check next">
        {steps.map((s, i) => (
          <button
            key={s.verb}
            className={i === step ? "current" : ""}
            onClick={() => setStep(i)}
            aria-current={i === step ? "step" : undefined}
          >
            <span>0{i + 1}</span>{s.verb}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={step}
          initial={reduced ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {steps[step]!.detail}
        </motion.p>
      </AnimatePresence>
      <p className="process-invitation">
        Let's follow one observation. You'll play both sides - citizen and researcher - to see how One Health works in practice.
      </p>
    </section>
  );
}
