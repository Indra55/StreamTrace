import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { River } from "./effects.tsx";
export function Opening({reduced}:{reduced:boolean}) {
  const [arrived,setArrived]=useState(reduced);
  useEffect(()=>{if(reduced){setArrived(true);return;}const timer=setTimeout(()=>setArrived(true),2600);return()=>clearTimeout(timer);},[reduced]);
  return <section id="opening" className="opening-scene">
    <River reduced={reduced}/>
    <AnimatePresence mode="wait">
      {!arrived?<motion.div key="signal" className="opening-whisper" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.8}}>Something is changing.</motion.div>:
      <motion.div key="story" className="opening-copy" initial={reduced?false:{opacity:0,y:22}} animate={{opacity:1,y:0}} transition={{duration:1.5,ease:[.22,1,.36,1]}}>
        <span className="story-kicker">A small observation. A bigger picture.</span>
        <h1>Our waters are changing.<br/><em>Look a little closer.</em></h1>
        <p>In a changing climate, caring for our waterways starts with paying attention. A patch of foam. A change in colour. Something that wasn’t there before.</p>
        <p className="opening-invitation">You notice it. Together, we can follow it.</p>
      </motion.div>}
    </AnimatePresence>
  </section>;
}
const steps=[{verb:"You notice.",detail:"A citizen sees something unusual and reports what they saw."},{verb:"We connect.",detail:"Researchers check the observation and put it in context."},{verb:"The search narrows.",detail:"Reviewed evidence helps reveal where to look next."},{verb:"Someone looks again.",detail:"One more observation. A clearer picture of the stream."}];
export function Process({reduced}:{reduced:boolean}) {
  const [step,setStep]=useState(0);
  useEffect(()=>{if(reduced)return;const timer=setInterval(()=>setStep(s=>Math.min(s+1,3)),2500);return()=>clearInterval(timer);},[reduced]);
  return <section id="process" className="process-scene"><span className="story-kicker">What we do</span><h1>Turn a moment of noticing<br/>into a place to <em>start looking.</em></h1>
    <div className="process-line" aria-label="Report, review, narrow, check next">{steps.map((s,i)=><button key={s.verb} className={i===step?"current":""} onClick={()=>setStep(i)} aria-current={i===step?"step":undefined}><span>0{i+1}</span>{s.verb}</button>)}</div>
    <AnimatePresence mode="wait"><motion.p key={step} initial={reduced?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.45}}>{steps[step]!.detail}</motion.p></AnimatePresence>
    <p className="process-invitation">Let’s follow one observation. You’ll play both sides.</p>
  </section>;
}
