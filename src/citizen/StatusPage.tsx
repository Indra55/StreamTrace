import { useEffect,useState } from "react";
import { request } from "../api.ts";
import { CitizenFrame,Link,demoMode } from "./navigation.tsx";
import { useDemoState,demoStatus } from "./demo-store.ts";
import { simulatedReceipt,statusSchema,receiptCase } from "./model.ts";
export default function StatusPage({refId}:{refId:string}) {
  const demo=useDemoState(),simulated=demoMode() || simulatedReceipt(refId) || demoStatus(refId)!==null;
  const [status,setStatus]=useState<string|null>(null),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
  useEffect(()=>{if(simulated){setStatus(demoStatus(refId)?.state??null);setError(demoStatus(refId)?"":"Simulated report is no longer in memory.");return;}
    let active=true;const controller=new AbortController();setStatus(null);setError("");request<unknown>(`/api/reports/${encodeURIComponent(refId)}/status`,{signal:controller.signal}).then(data=>{if(active)setStatus(statusSchema.parse(data).state);}).catch(()=>{if(active){setStatus(null);setError("Report status is unavailable. Try again later.");}});return()=>{active=false;controller.abort();};
  },[refId,simulated,demo,refresh]);
  const states:Record<string,{icon:string;label:string}>={pending:{icon:"◷",label:"Pending researcher review"},approved:{icon:"✓",label:"Approved"},rejected:{icon:"×",label:"Rejected"},uncertain:{icon:"?",label:"Uncertain"}};
  return <CitizenFrame simulated={simulated}><p className="eyebrow">Report status</p><h1>Your report reference</h1><p className="report-reference">{refId}</p>{status&&states[status]?<p className="report-state" role="status"><span aria-hidden="true">{states[status].icon}</span>{states[status].label}</p>:<p role="status">{error||"Checking report status..."}</p>}{simulated?<p>This report was simulated in your browser. It was not sent to signed-in researchers. <Link href="/demo">Open the interactive demo</Link> or <Link href="/report?mode=live">submit a real observation</Link>.</p>:<p>Your report is saved for signed-in researchers to review.</p>}<p>A researcher will review this. {receiptCase(refId)?"Your report does not change the investigation until it is approved.":"General-inbox reports never change investigation candidates."}</p><button onClick={()=>setRefresh(n=>n+1)}>Refresh status</button>{receiptCase(refId)&&<Link className="citizen-button" href={`/task?mode=${simulated?"demo":"live"}&case=${encodeURIComponent(receiptCase(refId)!)}`}>Open next field task</Link>}<Link className="next-task-link" href={`/report?mode=${simulated?"demo":"live"}`}>Report another observation</Link></CitizenFrame>;
}
