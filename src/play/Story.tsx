import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { River } from "./effects.tsx";

/** Word-by-word reveal with blur-to-sharp entrance. */
function WordReveal({ words, startDelay = 0, reduced }: {
  words: string[]; startDelay?: number; reduced: boolean;
}) {
  return <>{words.map((word, i) =>
    <motion.span
      key={i}
      style={{ display: "inline-block", marginRight: "0.28em" }}
      initial={reduced ? false : { opacity: 0, y: 26, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{
        duration: 0.75,
        delay: startDelay + i * 0.1,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {word}
    </motion.span>,
  )}</>;
}

export function Opening({ reduced }: { reduced: boolean }) {
  const [arrived, setArrived] = useState(reduced);
  useEffect(() => {
    if (reduced) { setArrived(true); return; }
    const timer = setTimeout(() => setArrived(true), 2600);
    return () => clearTimeout(timer);
  }, [reduced]);

  return (
    <section id="opening" className="opening-scene">
      <River reduced={reduced} />
      <AnimatePresence mode="wait">
        {!arrived ? (
          <motion.div
            key="signal"
            className="opening-whisper"
            initial={{ opacity: 0, filter: "blur(14px)", scale: 0.95 }}
            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
            exit={{ opacity: 0, filter: "blur(10px)", scale: 1.03 }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          >
            Something is changing.
          </motion.div>
        ) : (
          <motion.div
            key="story"
            className="opening-copy"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.span
              className="story-kicker"
              initial={reduced ? false : { opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              A small observation. A bigger picture.
            </motion.span>

            <h1>
              {reduced ? (
                <>Our waters are changing.<br /><em>Look a little closer.</em></>
              ) : (
                <>
                  <span className="h1-line">
                    <WordReveal words={["Our", "waters", "are", "changing."]} startDelay={0.15} reduced={reduced} />
                  </span>
                  <em>
                    <WordReveal words={["Look", "a", "little", "closer."]} startDelay={0.6} reduced={reduced} />
                  </em>
                </>
              )}
            </h1>

            <motion.p
              initial={reduced ? false : { opacity: 0, y: 16, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1.1, delay: 1.3, ease: [0.22, 1, 0.36, 1] }}
            >
              In a changing climate, healthy waters mean healthy ecosystems and
              healthy communities. A patch of foam. A change in colour. Dead fish
              that weren't there before. These signals connect water quality to
              the well-being of every living thing downstream.
            </motion.p>

            <motion.p
              className="opening-invitation"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 1.8, ease: [0.22, 1, 0.36, 1] }}
            >
              You notice it. Together, we can follow it - a <strong>One Health</strong> approach to protecting our waterways.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
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
        Turn a moment of noticing<br />
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
