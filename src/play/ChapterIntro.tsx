import { motion } from "framer-motion";
import type { Ref } from "react";
import type { Chapter } from "./timeline.ts";

export function ChapterIntro({ chapter, index, reduced, headingRef }: {
  chapter: Chapter;
  index: number;
  reduced: boolean;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  return <motion.section className="chapter-intro" aria-labelledby="chapter-intro-title"
    initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65 }}>
    <div className="chapter-intro-name">
      <span className="story-kicker">Chapter {String(index + 1).padStart(2, "0")} / {chapter.role === "citizen" ? "From the riverbank" : "At the research desk"}</span>
      <h1 id="chapter-intro-title" ref={headingRef} tabIndex={-1}>{chapter.title}</h1>
    </div>
    <div className="chapter-intro-summary">
      <span className="story-kicker">What happens here</span>
      <p>{chapter.caption}</p>
      <div className="chapter-intro-cue"><span>In this chapter</span><strong>{chapter.expected}</strong></div>
    </div>
  </motion.section>;
}
