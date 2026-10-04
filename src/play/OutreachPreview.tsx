import type { taskResponseSchema } from "../../shared/ai.ts";
import type { z } from "zod";

export function OutreachPreview({ site, task }: {
  site: string;
  task: z.infer<typeof taskResponseSchema>;
}) {
  const reportHref = `/report?mode=demo&site=${encodeURIComponent(site)}`;
  return <div className="outreach-preview">
    <div className="outreach-summary">
      <span className="story-kicker">From the research desk to the riverbank</span>
      <h2>A small ask.<br/>Another pair of eyes.</h2>
      <p>A field task carries the site, what to look for, and a link to record the observation.</p>
      <div className="outreach-status"><span aria-hidden="true">✓✓</span> Example request and volunteer replies</div>
      <p><strong>Ana / WhatsApp</strong><br/>“Not seen. I checked from the path.”</p>
      <p><strong>Bruno / SMS</strong><br/>“The water is moving too fast. Cannot tell.”</p>
      <p className="outreach-review-note">Replies still need confirmation in the form and researcher review. Cannot tell keeps the uncertainty visible.</p>
      <details className="outreach-task-text"><summary>Your mission task: site {site}</summary><p>{task.text_en}</p></details>
      <a className="outreach-form-link" href={reportHref} target="_blank" rel="noopener noreferrer">Try the linked report form <span aria-hidden="true">↗</span></a>
    </div>
    <figure className="outreach-conversations">
      <div className="outreach-image-wrap">
        <img src="/images/volunteer-outreach.png" width="1536" height="1024" alt="Simulated WhatsApp and SMS conversations for site 006. A researcher asks volunteers to look for foam from a public path and shares a field-task link. Ana replies Not seen. Bruno replies Cannot tell because the water is moving too fast. Both are asked to confirm their observation in the form for researcher review."/>
        <a className="outreach-hotspot outreach-whatsapp-link" href={reportHref} target="_blank" rel="noopener noreferrer" aria-label={`Open the simulated report form for site ${site} from the WhatsApp example`}/>
        <a className="outreach-hotspot outreach-sms-link" href={reportHref} target="_blank" rel="noopener noreferrer" aria-label={`Open the simulated report form for site ${site} from the SMS example`}/>
      </div>
      <figcaption><span className="outreach-swipe-hint">Swipe to see both conversations. </span>Illustrated example: site 006. The linked form opens your selected site {site}. No messages are sent.</figcaption>
    </figure>
  </div>;
}
