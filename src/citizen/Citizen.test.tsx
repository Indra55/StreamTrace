import { beforeEach,test,expect,vi } from "vitest";
import { render,screen,waitFor,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Routes from "../Routes.tsx";
import { network,evaluate } from "../demo.ts";
import { setDemoMode,navigate } from "./navigation.tsx";
import { resetDemo,getDemoState,addDemoReport,demoStatus,demoTask,demoDispatch } from "./demo-store.ts";
import { clarificationQuestions, draftInputSchema, parseDraft, DRAFT_PROMPT_VERSION } from "../../shared/ai.ts";
import { draftKey,freshDraft } from "./model.ts";
const caseId="10000000-0000-4000-8000-000000000001";
const investigationCase={id:caseId,title:"Foam investigation",signal:"foam",assumptions:"Test case",network_id:"coimbra-fixture",simulated:false};
function storage():Storage {
  const data=new Map<string,string>();
  return {get length(){return data.size;},clear(){data.clear();},getItem(key){return data.get(key)??null;},setItem(key,value){data.set(key,String(value));},removeItem(key){data.delete(key);},key(index){return [...data.keys()][index]??null;}};
}
beforeEach(()=>{vi.stubGlobal("localStorage",storage());vi.stubGlobal("sessionStorage",storage());setDemoMode(false);history.replaceState(null,"","/");resetDemo();});
function mockBackend(draft:(body:Record<string,unknown>)=>unknown=()=>({status:"ready",value:"present",source:"ai_draft",confidence:.8}),options:{cases?:typeof investigationCase[];networks?:Record<string,typeof network>}={}) {
  const bodies:{path:string;body:Record<string,unknown>}[]=[];
  const reports:Record<string,unknown>[]=[];
  const fetch=vi.fn(async(input:RequestInfo|URL,init:RequestInit={})=>{
    const path=String(input),body=init.body?JSON.parse(String(init.body)):{};if(init.body)bodies.push({path,body});
    if(path==="/api/login")return Response.json({ok:true});
    if(path==="/api/cases")return Response.json(options.cases??[investigationCase]);
    if(path.includes("/network"))return Response.json({case:investigationCase,graph:options.networks?.[path.split("/")[3]!]??network});
    if(path==="/api/draft"){
      const result=draft(body);if(result instanceof Response)return result;
      const raw=result as {status?:string;value?:"present"|"absent"|"cannot_tell";assumptions?:{persistence?:boolean|null;detectability?:boolean|null;flow?:boolean|null;recent_rain?:"yes"|"no"|"cannot_tell"}};
      const input=draftInputSchema.parse(body),base=parseDraft(input),a=raw.assumptions;
      const assumptions=a?{persistence:a.persistence===true?"yes" as const:a.persistence===false?"no" as const:base.assumptions.persistence,
        detectability:a.detectability===true?"yes" as const:a.detectability===false?"no" as const:base.assumptions.detectability,
        flow_conditions:a.flow===true?"yes" as const:a.flow===false?"no" as const:base.assumptions.flow_conditions,
        recent_rain:a.recent_rain===undefined||a.recent_rain==="cannot_tell"?base.assumptions.recent_rain:a.recent_rain}:base.assumptions;
      const value=raw.value??base.value,questions=clarificationQuestions(value,assumptions,input.round,input.answers),source=raw.status==="fallback"?"fallback":"ai";
      return Response.json({...base,value,assumptions,questions,source,status:source==="fallback"?"fallback":questions.length?"needs_clarification":"complete",model:source==="ai"?"mock-model":null,prompt_version:DRAFT_PROMPT_VERSION,latency_ms:1});
    }
    if(path==="/api/reports"){reports.push({...body,review_state:"unreviewed"});return Response.json({id:body.id,ref:"ABCDEFGH23456789",review_state:"unreviewed"},{status:201});}
    if(path.includes("/status"))return Response.json({ref:path.split("/")[3],state:"pending",reviewer_id:"never-display",notes:"never-display"});
    if(path==="/api/public/reports")return Response.json([]);
    if(path==="/api/reviewer/cases")return Response.json(options.cases??[investigationCase]);
    if(path==="/api/reviewer/queue")return Response.json(reports);
    if(path.includes("/export?format=json"))return Response.json({case:(options.cases??[investigationCase]).find(c=>c.id===path.split("/")[3]),graph:network,reports:reports.filter(r=>r.case_id===path.split("/")[3]),decisions:[],events:[],analysis:{candidates:network.reaches.map(r=>r.id),steps:[],checkedSites:[],status:"awaiting_review",recommendation:null,message:"Awaiting review"}});
    throw new Error(`Unexpected route ${path}`);
  });vi.stubGlobal("fetch",fetch);return {fetch,bodies};
}
async function toGuide(user:ReturnType<typeof userEvent.setup>,location=false,value="Seen"){
  if(location)await user.click(await screen.findByRole("button",{name:"Use my location"}));
  else await user.click(await screen.findByRole("button",{name:"Site 009"}));
  await user.click(screen.getByRole("button",{name:"Continue"}));
  await user.click(screen.getByRole("button",{name:value}));await user.click(screen.getByRole("button",{name:"Continue"}));
  await user.type(screen.getByRole("textbox",{name:/Describe it/}),"I see foam.");await user.click(screen.getByRole("button",{name:"Check my report"}));
}
async function context(user:ReturnType<typeof userEvent.setup>){
  if(screen.queryByText("Context round 1 of 2")) {
    while(screen.queryByRole("button",{name:"Continue context"})) {
      for(const group of screen.getAllByRole("group"))await user.click(within(group).getByRole("button",{name:group.textContent?.includes("rain")?/^No/:/^Yes/}));
      await user.click(screen.getByRole("button",{name:"Continue context"}));
      await waitFor(()=>expect(screen.queryByText("Checking your report...")).toBeNull());
    }
  }
  await screen.findByRole("heading",{name:"Is this what you observed?"});
}
async function confirmSubmit(user:ReturnType<typeof userEvent.setup>){await user.click(screen.getByRole("checkbox",{name:"I confirm this summary matches my observation."}));await user.click(screen.getByRole("button",{name:"Continue to submit"}));await user.click(screen.getByRole("button",{name:"Submit report"}));}
test("landing explains the product and links to the demo and citizen report without requests",()=>{
  const fetch=vi.fn();vi.stubGlobal("fetch",fetch);render(<Routes/>);
  expect(screen.getByRole("heading",{name:"Where should we check next?"})).toBeTruthy();
  expect(screen.getByRole("link",{name:"Report what you see"}).getAttribute("href")).toBe("/report");
  expect(screen.getByRole("link",{name:"Open the interactive demo"}).getAttribute("href")).toBe("/demo");
  expect(fetch).not.toHaveBeenCalled();
});
test("Seen reports skip context and displays a private-safe status",async()=>{
  const b=mockBackend();history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();
  await toGuide(user);await context(user);expect(screen.getByText("AI draft, please check")).toBeTruthy();
  await confirmSubmit(user);expect(await screen.findByText("Pending researcher review")).toBeTruthy();
  const sent=b.bodies.find(b=>b.path==="/api/reports")!.body;
  expect(sent.confirmed).toBe(true);expect(sent.review_state).toBeUndefined();expect(sent.citizen_context).toMatchObject({source:"ai_draft",assumptions:{persistence:null,detectability:null,flow:null,recent_rain:"cannot_tell"}});
  expect(screen.queryByText("never-display")).toBeNull();expect(window.localStorage.getItem(draftKey)).toBeNull();
});
test("Not seen context is capped at two questions per round and two rounds",async()=>{
  const b=mockBackend(()=>({status:"needs_clarification",value:"absent",assumptions:{persistence:null,detectability:null,flow:null,recent_rain:"cannot_tell"}}));
  history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();await toGuide(user,false,"Not seen");
  for(let round=0;round<2;round++) {
    await screen.findByText(`Context round ${round+1} of 2`);expect(screen.getAllByRole("group")).toHaveLength(2);
    for(const group of screen.getAllByRole("group"))await user.click(within(group).getByRole("button",{name:"Unknown"}));
    await user.click(screen.getByRole("button",{name:"Continue context"}));
  }
  await screen.findByRole("heading",{name:"Is this what you observed?"});expect(screen.queryByRole("button",{name:"Continue context"})).toBeNull();expect(b.bodies.filter(b=>b.path==="/api/draft")).toHaveLength(3);
  await confirmSubmit(user);await screen.findByText("Pending researcher review");
  expect(b.bodies.find(b=>b.path==="/api/reports")!.body.citizen_context).toMatchObject({assumptions:{persistence:null,detectability:null,flow:null,recent_rain:"cannot_tell"}});
});
test("context already found in the AI draft is not asked again",async()=>{
  mockBackend(()=>({status:"ready",value:"absent",assumptions:{persistence:true,detectability:false,flow:null,recent_rain:"no"}}));history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();await toGuide(user,false,"Not seen");
  await screen.findByText("Context round 1 of 2");expect(screen.getAllByRole("group")).toHaveLength(1);expect(screen.getByRole("group").textContent).toContain("normal");await context(user);
});
test.each(["fallback","http","network"])("API draft %s failure falls back to the parser without blocking submission",async failure=>{
  const b=mockBackend(()=>{if(failure==="network")throw new Error("Connection lost");return failure==="http"?Response.json({error:"fallback"},{status:502}):{status:"fallback"};});history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();
  await toGuide(user);await context(user);expect(screen.getByText("Automatic help unavailable, using simple form")).toBeTruthy();
  await confirmSubmit(user);await screen.findByText("Pending researcher review");expect(b.bodies.find(b=>b.path==="/api/reports")!.body.citizen_context).toMatchObject({source:"parser_draft"});
});
test("geolocation raw coordinates never enter requests or local storage",async()=>{
  const b=mockBackend(),site=network.sites.find(s=>s.code==="009")!;
  const latitude=site.coordinates[1]!+.00001,longitude=site.coordinates[0]!+.00001;
  Object.defineProperty(navigator,"geolocation",{configurable:true,value:{getCurrentPosition:(success:(p:unknown)=>void)=>success({coords:{latitude,longitude,accuracy:10}})}});
  history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();await toGuide(user,true);await context(user);
  const unfinished=window.localStorage.getItem(draftKey)!;expect(unfinished).not.toContain(String(latitude));expect(unfinished).not.toContain(String(longitude));expect(unfinished).not.toMatch(/latitude|longitude|coordinates/);
  await confirmSubmit(user);await screen.findByText("Pending researcher review");
  const serialized=JSON.stringify(b.bodies);expect(serialized).not.toContain(String(latitude));expect(serialized).not.toContain(String(longitude));expect(serialized).not.toMatch(/latitude|longitude|coordinates/);
  expect(JSON.stringify(localStorage)).not.toContain(String(latitude));expect(b.bodies.find(b=>b.path==="/api/reports")!.body.citizen_context).toMatchObject({site_distance_m:expect.any(Number)});
});
test("task conflict 409 shows the expert-review state",async()=>{
  const fetch=vi.fn(async(input:RequestInfo|URL)=>String(input)==="/api/cases"?Response.json([investigationCase]):Response.json({error:"No task"},{status:409}));vi.stubGlobal("fetch",fetch);
  history.replaceState(null,"","/task");render(<Routes/>);expect(await screen.findByText("No task")).toBeTruthy();expect(screen.queryByRole("link",{name:"Report from this site"})).toBeNull();
});
test("demo citizen flow reaches the seeded reviewer queue without network calls",async()=>{
  const fetch=vi.fn(()=>Promise.reject(new Error("Demo must stay offline")));vi.stubGlobal("fetch",fetch);setDemoMode(true);history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();
  await toGuide(user);await context(user);expect(screen.getByText("Demo uses the simple form. No AI request is sent.")).toBeTruthy();await confirmSubmit(user);await screen.findByText("Pending researcher review");
  expect(getDemoState().observations).toHaveLength(4);await user.click(screen.getByRole("link",{name:"Open the interactive demo"}));
  await user.click(screen.getAllByText("Read pending citizen report at site 009",{selector:"summary"}).at(-1)!);
  expect(await screen.findByRole("article",{name:"Citizen simulated observation at site 009"})).toBeTruthy();expect(fetch).not.toHaveBeenCalled();
  const card=within(screen.getByRole("article",{name:"Citizen simulated observation at site 009"}));
  expect((card.getByRole("checkbox",{name:"I acknowledge the case assumptions"}) as HTMLInputElement).checked).toBe(false);
});
test("an unconfirmed AI draft cannot be submitted and editing invalidates confirmation",async()=>{
  mockBackend();history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();await toGuide(user);await context(user);
  expect((screen.getByRole("button",{name:"Continue to submit"}) as HTMLButtonElement).disabled).toBe(true);expect(screen.queryByRole("button",{name:"Submit report"})).toBeNull();
  await user.click(screen.getByRole("checkbox",{name:"I confirm this summary matches my observation."}));expect((screen.getByRole("button",{name:"Continue to submit"}) as HTMLButtonElement).disabled).toBe(false);
  await user.selectOptions(screen.getByLabelText("Observation"),"cannot_tell");expect((screen.getByRole("button",{name:"Continue to submit"}) as HTMLButtonElement).disabled).toBe(true);
});
test("an unfinished report restores the selected site without restoring confirmation",async()=>{
  mockBackend();history.replaceState(null,"","/report");const view=render(<Routes/>);const user=userEvent.setup();await user.click(await screen.findByRole("button",{name:"Site 009"}));
  await waitFor(()=>expect(JSON.parse(window.localStorage.getItem(draftKey)!).site).toBe("009"));view.unmount();render(<Routes/>);expect(await screen.findByText("009",{selector:"strong"})).toBeTruthy();
});
test("template demo task requests only structured wording facts and preselects its site",async()=>{
  const fetch=vi.fn(async(_input:RequestInfo|URL,_init?:RequestInit)=>Response.json({error:"budget"},{status:429}));vi.stubGlobal("fetch",fetch);setDemoMode(true);history.replaceState(null,"","/task");render(<Routes/>);const user=userEvent.setup();
  expect(await screen.findByText("Standard instruction")).toBeTruthy();await user.click(screen.getByRole("link",{name:"Report from this site"}));
  const selected=await screen.findByText(/Selected site:/);expect(selected.querySelector("strong")?.textContent).toBeTruthy();expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0]![0]).toBe("/api/demo/task");expect(Object.keys(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).sort()).toEqual(["facts","signal","site"]);
});

test.each(["task","restored"])("a %s report stays in the selected case when another case has the same signal",async entry=>{
  const selected={...investigationCase,id:"10000000-0000-4000-8000-000000000002"};
  const b=mockBackend(undefined,{cases:[investigationCase,selected]});
  if(entry==="restored")localStorage.setItem(draftKey,JSON.stringify({...freshDraft(),caseId:selected.id,site:"009"}));
  history.replaceState(null,"",entry==="task"?`/report?site=009&case=${selected.id}`:"/report");render(<Routes/>);const user=userEvent.setup();
  await toGuide(user);await context(user);await confirmSubmit(user);await screen.findByText("Pending researcher review");
  expect(b.bodies.find(b=>b.path==="/api/reports")!.body.case_id).toBe(selected.id);
  expect(b.fetch.mock.calls.some(([path])=>String(path)===`/api/cases/${selected.id}/network`)).toBe(true);
});

test("the form stays on the current case and Something else goes to the general inbox",async()=>{
  const colour={...investigationCase,id:"10000000-0000-4000-8000-000000000003",signal:"colour"};const b=mockBackend(undefined,{cases:[investigationCase,colour]});
  history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();await screen.findByRole("button",{name:"Report foam"});expect(document.querySelector(".current-investigation")?.textContent).toBe("Current investigation: Foam investigation");expect(screen.queryByRole("button",{name:"Colour"})).toBeNull();expect(screen.queryByText("Odour")).toBeNull();
  await user.click(screen.getByRole("button",{name:"Something else"}));await user.click(screen.getByRole("button",{name:"Continue"}));await user.type(screen.getByRole("textbox",{name:/Describe it/}),"A blocked public path");await user.click(screen.getByRole("button",{name:"Check my report"}));await confirmSubmit(user);await screen.findByText("Pending researcher review");
  expect(b.bodies.find(b=>b.path==="/api/reports")!.body).toMatchObject({case_id:null,signal:"other",site_code:null});expect(b.bodies.some(b=>b.path==="/api/draft")).toBe(false);expect(screen.queryByRole("link",{name:"Open next field task"})).toBeNull();
});
test.each([0,404,500,502,503])("task outage %s requires choosing a simulated task",async status=>{
  const fetch=vi.fn(async(input:RequestInfo|URL)=>{if(String(input)==="/api/cases")return Response.json([investigationCase]);if(!status)throw new Error("Backend unavailable");return Response.json({error:"Unavailable"},{status});});vi.stubGlobal("fetch",fetch);
  history.replaceState(null,"","/task");render(<Routes/>);const user=userEvent.setup();
  await screen.findByText("A field task could not be loaded. Please try again later.");expect(screen.queryByText("Standard instruction")).toBeNull();
  await user.click(screen.getByRole("button",{name:"Try a simulated task"}));
  await screen.findByText("Standard instruction");expect(screen.getByText("Demo mode: simulated task facts may be sent for wording. No reports are saved.")).toBeTruthy();
  const attempts=fetch.mock.calls.length;
  await user.click(screen.getByRole("link",{name:"Report from this site"}));await toGuide(user);await context(user);await confirmSubmit(user);await screen.findByText("Pending researcher review");
  await user.click(screen.getByRole("link",{name:"Open the interactive demo"}));await user.click(screen.getAllByText("Read pending citizen report at site 009",{selector:"summary"}).at(-1)!);await screen.findByRole("article",{name:"Citizen simulated observation at site 009"});
  expect(fetch).toHaveBeenCalledTimes(attempts);
});

test("a report with no backend requires explicit simulation before entering the offline reviewer queue",async()=>{
  const fetch=vi.fn(async()=>Response.json({error:"Proxy unavailable"},{status:500}));vi.stubGlobal("fetch",fetch);
  history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();
  await screen.findByRole("alert");expect(getDemoState().observations).toHaveLength(3);
  expect(screen.queryByRole("button",{name:"Submit report"})).toBeNull();
  await user.click(screen.getByRole("button",{name:"Try a simulated report"}));
  await toGuide(user);await context(user);await confirmSubmit(user);await screen.findByText("Pending researcher review");
  await user.click(screen.getByRole("link",{name:"Open the interactive demo"}));await user.click(screen.getAllByText("Read pending citizen report at site 009",{selector:"summary"}).at(-1)!);await screen.findByRole("article",{name:"Citizen simulated observation at site 009"});
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("reviewer context is visible but explicit checks are still required",async()=>{
  const fetch=vi.fn();vi.stubGlobal("fetch",fetch);setDemoMode(true);
  addDemoReport({...freshDraft(),site:"009",value:"absent",source:"ai_draft",assumptions:{persistence:true,detectability:true,flow:true,recent_rain:"no"}});
  history.replaceState(null,"","/demo");render(<Routes/>);const user=userEvent.setup();
  await user.click(screen.getAllByText("Read pending citizen report at site 009",{selector:"summary"}).at(-1)!);
  const card=within(await screen.findByRole("article",{name:"Citizen simulated observation at site 009"}));
  expect(card.getByText("AI draft")).toBeTruthy();
  expect(card.getByRole("region",{name:"Citizen context answers"})).toBeTruthy();expect(card.getAllByText("Yes",{selector:"dd"})).toHaveLength(3);expect(card.getByText("No",{selector:"dd"})).toBeTruthy();expect(card.queryByRole("textbox",{name:/Reason for approving/})).toBeNull();
  const assumptions=card.getByRole("checkbox",{name:"I acknowledge the case assumptions"}) as HTMLInputElement;
  const comparable=card.getByRole("checkbox",{name:"Absence is comparable, persistent and detectable"}) as HTMLInputElement;
  expect(assumptions.checked).toBe(false);expect(comparable.checked).toBe(false);
  expect((card.getByRole("button",{name:"Approve"}) as HTMLButtonElement).disabled).toBe(true);
  await user.click(assumptions);expect((card.getByRole("button",{name:"Approve"}) as HTMLButtonElement).disabled).toBe(true);
  await user.click(comparable);expect((card.getByRole("button",{name:"Approve"}) as HTMLButtonElement).disabled).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});

test("demo status does not request the backend when browser storage is blocked",async()=>{
  const fetch=vi.fn();vi.stubGlobal("fetch",fetch);setDemoMode(true);
  vi.stubGlobal("localStorage",{getItem:()=>{throw new Error("Storage blocked");},setItem:()=>{throw new Error("Storage blocked");},removeItem:()=>{throw new Error("Storage blocked");}});
  history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();
  await toGuide(user);await context(user);await confirmSubmit(user);await screen.findByText("Pending researcher review");expect(fetch).not.toHaveBeenCalled();
});

test("real citizen submission appears in the connected reviewer queue and selects its investigation",async()=>{
  const other={...investigationCase,id:"10000000-0000-4000-8000-000000000002",signal:"colour"};
  const b=mockBackend(undefined,{cases:[other,investigationCase]});history.replaceState(null,"",`/report?case=${caseId}`);render(<Routes/>);const user=userEvent.setup();
  await toGuide(user);await context(user);await confirmSubmit(user);await screen.findByText("Pending researcher review");
  expect(screen.getByText("Your report is saved for signed-in researchers to review.")).toBeTruthy();
  await user.click(screen.getByRole("link",{name:"Reviewer sign in"}));
  await user.type(screen.getByLabelText("Email"),"reviewer@example.invalid");await user.type(screen.getByLabelText("Password"),"test-password");await user.click(screen.getByRole("button",{name:"Sign in"}));
  const card=within(await screen.findByRole("article",{name:"Submitted observation at site 009"}));
  expect((screen.getByRole("combobox",{name:"Investigation case"}) as HTMLSelectElement).value).toBe(caseId);
  expect(card.getByText("Pending")).toBeTruthy();expect(card.getByText("AI draft")).toBeTruthy();
  expect((card.getByRole("checkbox",{name:"I acknowledge the case assumptions"}) as HTMLInputElement).checked).toBe(false);
  expect((card.getByRole("button",{name:"Approve"}) as HTMLButtonElement).disabled).toBe(true);
  expect(getDemoState().observations).toHaveLength(3);expect(b.bodies.filter(b=>b.path==="/api/reports")).toHaveLength(1);
});

test("legacy automatic demo mode does not redirect real submissions into memory",async()=>{
  sessionStorage.setItem("streamtrace.mode","demo");const b=mockBackend();history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();
  await toGuide(user);await context(user);await confirmSubmit(user);await screen.findByText("Pending researcher review");
  expect(b.bodies.some(b=>b.path==="/api/reports")).toBe(true);expect(getDemoState().observations).toHaveLength(3);
});

test.each([{cases:[]},{cases:[{...investigationCase,simulated:true}]}])("missing live cases allow general reports without simulated evidence",async({cases})=>{
  const b=mockBackend(undefined,{cases});history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();await screen.findByText("You can send a general observation without selecting a site.");await user.click(screen.getByRole("button",{name:"Continue"}));await user.type(screen.getByRole("textbox",{name:/Describe it/}),"A public path is blocked");await user.click(screen.getByRole("button",{name:"Check my report"}));await confirmSubmit(user);await screen.findByText("Pending researcher review");expect(b.bodies.find(b=>b.path==="/api/reports")!.body.case_id).toBeNull();expect(getDemoState().observations).toHaveLength(3);
});

test("a failed real submission keeps the draft for retry without publishing into the demo queue",async()=>{
  const b=mockBackend(),original=b.fetch.getMockImplementation()!;
  let fail=true;const submitted:Record<string,unknown>[]=[];
  vi.stubGlobal("fetch",vi.fn((input:RequestInfo|URL,init:RequestInit={})=>{
    if(String(input)==="/api/reports"){submitted.push(JSON.parse(String(init.body)));if(fail){fail=false;return Promise.resolve(Response.json({error:"Service unavailable"},{status:500}));}}
    return original(input,init);
  }));
  history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();await toGuide(user);await context(user);await confirmSubmit(user);
  await screen.findByRole("alert");expect(getDemoState().observations).toHaveLength(3);expect(localStorage.getItem(draftKey)).toBeTruthy();
  expect(screen.queryByText("Pending researcher review")).toBeNull();
  await user.click(screen.getByRole("button",{name:"Submit report"}));await screen.findByText("Pending researcher review");
  expect(submitted).toHaveLength(2);expect(submitted[0]!.id).toBe(submitted[1]!.id);
});

test("simulated general reports receive random references without changing evidence",()=>{
  const before=getDemoState(),candidates=evaluate(before,network).candidates;const ref=addDemoReport({...freshDraft(),general:true,signal:"other",text:"Blocked path"});expect(ref).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{16}$/);expect(demoStatus(ref)).toEqual({state:"pending"});expect(getDemoState().observations).toEqual(before.observations);expect(evaluate(getDemoState(),network).candidates).toEqual(candidates);
});
test("demo task disappears when all approved evidence is withdrawn",()=>{
  expect(demoTask()?.case_title).toBe("Foam investigation");expect(demoTask()?.facts.approved_observations).toBe(2);for(const decision of getDemoState().decisions.filter(d=>d.state==="approved"))demoDispatch({type:"review",id:decision.report_id,state:"unreviewed",assumptions:false,comparable:false,at:new Date().toISOString()});expect(demoTask()).toBeNull();
});


test("live v2 task displays engine facts and links to the same case and site",async()=>{
  const fetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    if(String(input)==="/api/cases")return Response.json([investigationCase]);
    expect(String(input)).toBe("/api/task");expect(JSON.parse(String(init?.body))).toEqual({case_id:caseId});
    return Response.json({site:"009",text_en:"At site 009, look for foam. Stay on safe public paths. Do not enter the water. Skip the observation if it is unsafe. Report seen, not seen or cannot tell.",source:"template",facts:{total:14,seen_leaves:7,not_seen_leaves:7},model:null,prompt_version:"task-v2-1",latency_ms:1});
  });vi.stubGlobal("fetch",fetch);history.replaceState(null,"","/task?mode=live");render(<Routes/>);
  await screen.findByRole("heading",{name:"Check site 009"});expect(screen.getByText(/Do not enter the water/)).toBeTruthy();
  expect(screen.getByRole("link",{name:"Report from this site"}).getAttribute("href")).toBe(`/report?mode=live&site=009&case=${caseId}`);
  expect(screen.queryByText("Demo mode",{exact:false})).toBeNull();
});

test("generic Report lets the citizen choose another active investigation",async()=>{
  const discharge={...investigationCase,title:"Discharge investigation",signal:"discharge"};
  const foam={...investigationCase,id:"10000000-0000-4000-8000-000000000002"};
  const backend=mockBackend(undefined,{cases:[discharge,foam]});
  history.replaceState(null,"","/report");render(<Routes/>);const user=userEvent.setup();
  await screen.findByRole("button",{name:"Report discharge"});
  await user.selectOptions(screen.getByRole("combobox",{name:"Investigation"}),foam.id);
  await screen.findByRole("button",{name:"Report foam"});
  await waitFor(()=>expect(screen.getByRole("button",{name:"Continue"}).hasAttribute("disabled")).toBe(true));
  expect(backend.fetch.mock.calls.some(([path])=>String(path)===`/api/cases/${foam.id}/network`)).toBe(true);
  expect(JSON.parse(localStorage.getItem(draftKey)!).caseId).toBe(foam.id);
});
