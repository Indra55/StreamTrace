import { act,fireEvent,render,screen,waitFor,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach,test,expect,vi } from "vitest";
import App from "./Routes.tsx";
import { emptyAssumptions } from "../shared/observations.ts";
import { network } from "./demo.ts";
const caseId="10000000-0000-4000-8000-000000000001",reportId="20000000-0000-4000-8000-000000000001";
beforeEach(()=>history.replaceState(null,"","/review"));
function backend(options:{authenticated?:boolean;empty?:boolean;failedReview?:boolean;failedSubmission?:boolean;failedExport?:boolean;pendingReport?:boolean;seen?:boolean;known?:boolean;inbox?:boolean}={}) {
  let authenticated=options.authenticated ?? true;
  let candidates=network.reaches.slice(0,7).map(r=>r.id);
  let state=options.pendingReport ? "unreviewed" : "approved",revision=1,submitAttempts=0;
  const reports=[{id:reportId,case_id:caseId,signal:"foam",site_code:"009",value:options.seen ? "present" : "absent",citizen_context:{source:"manual",assumptions:options.known ? {persistence:false,detectability:false,flow:false,recent_rain:"no"} : emptyAssumptions},confirmed:true,observed_at:"2026-10-04T00:00:00Z",notes:"Fixture observation",origin:"web",review_state:"unreviewed"}];
  const investigationCase={id:caseId,signal:"foam",assumptions:"Fixture case",network_id:"coimbra-fixture",simulated:false};
  const calls:{path:string;options:RequestInit}[]=[];
  const fetch=vi.fn(async(input:RequestInfo|URL,init:RequestInit={})=>{
    const path=String(input);calls.push({path,options:init});
    if(path==="/api/public/reports") return Response.json([]);
    if(path==="/api/login") {authenticated=true;return Response.json({ok:true});}
    if(path==="/api/logout") {authenticated=false;return Response.json({ok:true});}
    if(!authenticated) return Response.json({error:"Authentication required"},{status:401});
    if(path==="/api/reviewer/cases") return Response.json(options.empty ? [] : [investigationCase]);
    if(path==="/api/reviewer/queue") return Response.json([...(state==="unreviewed" ? [{case_id:caseId}] : []),...(options.inbox ? [{id:"30000000-0000-4000-8000-000000000001",case_id:null,signal:"other",site_code:null,value:"cannot_tell",notes:"A blocked public path",observed_at:"2026-10-04T00:00:00Z"}] : [])]);
    if(path.endsWith("/export?format=fhir")) return options.failedExport ? Response.json({error:"Service unavailable"},{status:500}) : Response.json({resourceType:"Bundle",type:"collection",entry:[]});
    if(path.includes("/export?format=")) return Response.json({case:investigationCase,graph:network,reports,
      decisions:[{report_id:reportId,revision,state,assumptions_acknowledged:state==="approved",absence_comparable:state==="approved"}],
      events:[{report_id:reportId,revision,state,created_at:"2026-10-04T00:00:00Z"}],
      analysis:{candidates,steps:[],checkedSites:[],status:"active",recommendation:null,message:"Server analysis"}});
    if(path==="/api/reviews") {
      if(options.failedReview) return Response.json({error:"Service unavailable"},{status:500});
      const body=JSON.parse(String(init.body));state=body.state;revision++;candidates=network.reaches.slice(0,state==="unreviewed" ? 14 : 7).map(r=>r.id);
      return Response.json({ok:true});
    }
    if(path==="/api/reports") {
      if(options.failedSubmission && submitAttempts++===0) return Response.json({error:"Service unavailable"},{status:500});
      const body=JSON.parse(String(init.body));reports.push({...body,review_state:"unreviewed"});return Response.json({id:body.id,review_state:"unreviewed"},{status:201});
    }
    if(path==="/api/draft") return Response.json({error:"fallback"},{status:502});
    throw new Error(`Unexpected mock route ${path}`);
  });
  vi.stubGlobal("fetch",fetch);return {calls,fetch};
}
test("FHIR export downloads the API bundle with keyboard activation",async()=>{
  const b=backend();render(<App/>);const user=userEvent.setup();
  await user.click(await screen.findByRole("tab",{name:"Case"}));
  const button=await screen.findByRole("button",{name:"Download FHIR bundle (prototype)"});
  expect(screen.getByRole("button",{name:"Export JSON"}).parentElement).toBe(button.parentElement);
  const help=screen.getByText("Prototype FHIR R4 collection Bundle. Base R4, no profile conformance claimed. Validate before external use.");
  expect(button.getAttribute("aria-describedby")).toBe(help.id);
  let file:Blob|undefined;
  const createObjectURL=vi.fn((blob:Blob)=>{file=blob;return "blob:fhir-download";});
  vi.stubGlobal("URL",class extends URL {static createObjectURL=createObjectURL;static revokeObjectURL=vi.fn();});
  const downloads:{name:string;href:string}[]=[];
  vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(function(this:HTMLAnchorElement){downloads.push({name:this.download,href:this.href});});
  button.focus();expect(document.activeElement).toBe(button);
  await user.keyboard("{Enter}");
  await waitFor(()=>expect(downloads).toEqual([{name:`fhir-bundle-${caseId}.json`,href:"blob:fhir-download"}]));
  expect(b.calls.find(c=>c.path===`/api/cases/${caseId}/export?format=fhir`)?.options.credentials).toBe("include");
  expect(file?.type).toBe("application/fhir+json");
  const contents=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(file!);});
  expect(JSON.parse(contents)).toEqual({resourceType:"Bundle",type:"collection",entry:[]});
  expect((button as HTMLButtonElement).disabled).toBe(false);
});
test("FHIR download failure shows an accessible error and allows retry",async()=>{
  backend({failedExport:true});render(<App/>);const user=userEvent.setup();
  await user.click(await screen.findByRole("tab",{name:"Case"}));
  const button=await screen.findByRole("button",{name:"Download FHIR bundle (prototype)"});
  const click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
  await user.click(button);
  expect((await screen.findByRole("alert")).textContent).toBe("FHIR bundle download failed. Service unavailable");
  expect(click).not.toHaveBeenCalled();expect((button as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByTestId("candidate-count").textContent).toBe("7");
});
test("default app requires backend login and never loads the in-memory demo",async()=>{
  const b=backend({authenticated:false});render(<App/>);
  expect(await screen.findByRole("button",{name:"Sign in"})).toBeTruthy();
  expect(screen.queryByTestId("candidate-count")).toBeNull();
  expect(screen.queryByRole("button",{name:"Reset demo"})).toBeNull();
  expect(location.pathname).toBe("/login");
  expect(b.calls.some(c=>c.path==="/api/public/reports")).toBe(false);
  expect(b.calls.some(c=>c.path==="/api/reviewer/cases")).toBe(true);
});
test("login uses the API cookie session and displays server analysis",async()=>{
  const b=backend({authenticated:false});render(<App/>);const user=userEvent.setup();
  await user.type(await screen.findByLabelText("Email"),"reviewer@example.invalid");
  await user.type(screen.getByLabelText("Password"),"test-password");await user.click(screen.getByRole("button",{name:"Sign in"}));
  await waitFor(()=>expect(screen.getByTestId("candidate-count").textContent).toBe("7"));
  expect(b.calls.find(c=>c.path==="/api/login")?.options.credentials).toBe("include");
  expect(screen.getByRole("link",{name:"Open field task"}).getAttribute("href")).toBe(`/task?mode=live&case=${caseId}`);
  expect(screen.queryByRole("button",{name:"Load conflicting evidence"})).toBeNull();
});
test("withdrawal writes to the review API and refreshes candidates from the server",async()=>{
  const b=backend();render(<App/>);const user=userEvent.setup();
  await screen.findByTestId("candidate-count");await user.click(screen.getByText("Reviewed reports"));const evidence=within(screen.getByRole("article",{name:"Submitted observation at site 009"}));
  await user.click(evidence.getByRole("button",{name:"Withdraw"}));
  await waitFor(()=>expect(screen.getByTestId("candidate-count").textContent).toBe("14"));
  const call=b.calls.find(c=>c.path==="/api/reviews");expect(call?.options.method).toBe("POST");
  expect(JSON.parse(String(call?.options.body))).toEqual({report_id:reportId,state:"unreviewed",assumptions_acknowledged:false,absence_comparable:false,approval_reason:""});
});
test("failed review preserves the server state and presents an error",async()=>{
  backend({failedReview:true});render(<App/>);const user=userEvent.setup();await screen.findByTestId("candidate-count");await user.click(screen.getByText("Reviewed reports"));
  await user.click(screen.getByRole("button",{name:"Withdraw"}));expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByTestId("candidate-count").textContent).toBe("7");
});
test("submission retries keep one UUID and never send approval claims",async()=>{
  const b=backend({failedSubmission:true});render(<App/>);const user=userEvent.setup();await screen.findByTestId("candidate-count");
  await user.click(screen.getByRole("tab",{name:"Map"}));await user.click(screen.getByRole("tab",{name:"List"}));await user.click(screen.getByRole("button",{name:"Open site 002"}));
  await user.type(screen.getByLabelText("Observation notes"),"I see foam.");
  await user.click(screen.getByRole("button",{name:"Submit observation"}));await screen.findByRole("alert");
  await user.click(screen.getByRole("button",{name:"Submit observation"}));await screen.findByText("Added for review.");
  const bodies=b.calls.filter(c=>c.path==="/api/reports").map(c=>JSON.parse(String(c.options.body)));
  expect(bodies).toHaveLength(2);expect(bodies[0].id).toBe(bodies[1].id);expect(bodies[0].observed_at).toBe(bodies[1].observed_at);
  expect(bodies[0].case_id).toBe(caseId);expect(bodies[0].review_state).toBeUndefined();expect(bodies[0].revision).toBeUndefined();
});
test("draft fallback lets the reviewer choose a value without silently submitting",async()=>{
  const b=backend();render(<App/>);const user=userEvent.setup();await screen.findByTestId("candidate-count");
  await user.click(screen.getByRole("tab",{name:"Map"}));await user.click(screen.getByRole("tab",{name:"List"}));await user.click(screen.getByRole("button",{name:"Open site 002"}));
  await user.type(screen.getByLabelText("Observation notes"),"Maybe foam");await user.click(screen.getByRole("button",{name:"Suggest a draft"}));
  expect(await screen.findByText("Draft unavailable. Select the observation value yourself.")).toBeTruthy();
  expect(b.calls.some(c=>c.path==="/api/reports")).toBe(false);
});
test("no seeded cases is an explicit empty state",async()=>{
  backend({empty:true});render(<App/>);
  expect(await screen.findByRole("heading",{name:"No live investigation cases yet"})).toBeTruthy();expect(screen.queryByTestId("candidate-count")).toBeNull();
});
test("backend outage does not fall back to simulated evidence",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>{throw new Error("Unavailable");}));render(<App/>);
  expect(await screen.findByRole("alert")).toBeTruthy();expect(screen.queryByTestId("candidate-count")).toBeNull();
});
test("sign out clears the live workspace through the backend",async()=>{
  const b=backend();render(<App/>);const user=userEvent.setup();await screen.findByTestId("candidate-count");
  await user.click(screen.getByRole("button",{name:"Sign out"}));await screen.findByRole("button",{name:"Sign in"});
  expect(screen.queryByTestId("candidate-count")).toBeNull();expect(b.calls.some(c=>c.path==="/api/logout")).toBe(true);
});

test("approving unknown Not seen context requires a reason and sends it to the API",async()=>{
  const b=backend({pendingReport:true});render(<App/>);const user=userEvent.setup();const card=within(await screen.findByRole("article",{name:"Submitted observation at site 009"}));
  expect(card.getAllByText("Unknown",{selector:"dd"})).toHaveLength(4);expect(document.querySelectorAll(".context-unknown")).toHaveLength(4);
  await user.click(card.getByRole("checkbox",{name:"I acknowledge the case assumptions"}));await user.click(card.getByRole("checkbox",{name:"Absence is comparable, persistent and detectable"}));
  const approve=card.getByRole("button",{name:"Approve"}) as HTMLButtonElement,reason=card.getByRole("textbox",{name:/Reason for approving with unknown answers/});expect(approve.disabled).toBe(true);
  await user.type(reason,"Too short");expect(approve.disabled).toBe(true);await user.clear(reason);await user.type(reason,"Checked this on site");expect(approve.disabled).toBe(false);await user.click(approve);
  await waitFor(()=>expect(b.calls.some(c=>c.path==="/api/reviews")).toBe(true));expect(JSON.parse(String(b.calls.find(c=>c.path==="/api/reviews")!.options.body)).approval_reason).toBe("Checked this on site");
});
test.each([{seen:true},{known:true}])("Seen or fully known context needs no reason",async options=>{
  backend({...options,pendingReport:true});render(<App/>);const user=userEvent.setup();const card=within(await screen.findByRole("article",{name:"Submitted observation at site 009"}));expect(card.queryByRole("textbox",{name:/Reason for approving/})).toBeNull();await user.click(card.getByRole("checkbox",{name:"I acknowledge the case assumptions"}));if(options.known)await user.click(card.getByRole("checkbox",{name:"Absence is comparable, persistent and detectable"}));expect((card.getByRole("button",{name:"Approve"}) as HTMLButtonElement).disabled).toBe(false);
});
test("general reports remain visible when there are no live cases",async()=>{
  backend({empty:true,inbox:true});render(<App/>);const inbox=within(await screen.findByRole("region",{name:"General inbox"}));expect(inbox.getByText("A blocked public path")).toBeTruthy();expect(inbox.queryByRole("button",{name:"Approve"})).toBeNull();expect(screen.queryByTestId("candidate-count")).toBeNull();
});
