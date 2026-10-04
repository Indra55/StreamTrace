import { cleanup,render,screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach,expect,test,vi } from "vitest";
import { OneAquaHealth } from "./OneAquaHealth.tsx";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

test("loads source samples through the API and explains the limits",async ()=>{
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    source_url:"https://github.com/hl7-eu/oah/blob/b907cf0869b59d82d9138b3d147fca66f333d911/_samples/crete/ec.csv",
    revision:"test-revision",sha256:"test-checksum",kind:"published_reference_sample",indicator:"Electrical conductivity",unit:"mS/cm",
    sites:[{site:"Loc-Test",change:1,samples:[{date:"2024-11-21",device:"Test meter",value:2},{date:"2025-04-14",device:"Test meter",value:3}]}],
  })));
  vi.stubGlobal("fetch",fetcher);
  render(<OneAquaHealth/>);
  expect(fetcher).not.toHaveBeenCalled();
  await userEvent.setup().click(screen.getByRole("button",{name:"Load OneAquaHealth samples"}));
  await screen.findByRole("table");
  expect(fetcher.mock.calls[0]![0]).toMatch(/\/api\/oneaquahealth\/conductivity$/);
  expect(screen.getByText(/Change between.*\+1 mS\/cm/)).toBeTruthy();
  expect(screen.getByText(/separate from the Coimbra investigation/)).toBeTruthy();
  expect(screen.getByText(/cannot establish a pollution trend/)).toBeTruthy();
});

test("source failure shows an error without displaying fabricated measurements",async ()=>{
  vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("Offline")));
  render(<OneAquaHealth/>);
  await userEvent.setup().click(screen.getByRole("button",{name:"Load OneAquaHealth samples"}));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
});
