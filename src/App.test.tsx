import { test, expect, vi } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.tsx";
import { network } from "./demo.ts";

function confirmedNetwork() {
  return {
    ...network,
    metadata: {
      ...network.metadata,
      topology_review_state: "prototype_confirmed",
    },
    sites: network.sites.map((s) => ({ ...s, accessible: true })),
  };
}

test("approving pending absence then withdrawing restores candidates through the engine adapter", async () => {
  const user = userEvent.setup();
  render(<App initialView="Diagram" />);
  expect(screen.getByTestId("candidate-count").textContent).toBe("25");
  const pending = within(
    screen.getByRole("article", {
      name: "Pending simulated branch observation at site 003",
    }),
  );
  expect(
    (pending.getByRole("button", { name: "Approve" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await user.click(
    pending.getByLabelText("I acknowledge the case assumptions"),
  );
  expect(
    (pending.getByRole("button", { name: "Approve" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await user.click(
    pending.getByLabelText("Absence is comparable, persistent and detectable"),
  );
  await user.click(pending.getByRole("button", { name: "Approve" }));
  expect(screen.getByTestId("candidate-count").textContent).toBe("14");
  await user.click(pending.getByRole("button", { name: "Withdraw" }));
  expect(screen.getByTestId("candidate-count").textContent).toBe("25");
  expect(screen.getByText(/Demo reviewer withdrew approval/)).toBeTruthy();
});

test("conflict pauses an otherwise useful recommendation", async () => {
  const user = userEvent.setup();
  render(<App data={confirmedNetwork()} initialView="Diagram" />);
  expect(
    screen.getByRole("button", { name: "Open recommended site" }),
  ).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "Load conflicting evidence" }),
  );
  expect(screen.getByTestId("candidate-count").textContent).toBe("0");
  expect(
    screen.getByText("Evidence conflicts. A researcher must review."),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Open recommended site" }),
  ).toBeNull();
  expect(screen.queryByText("Check here next")).toBeNull();
});

test("unreviewed topology always hides geographic recommendations", () => {
  render(<App initialView="Diagram" />);
  expect(
    screen.getByText(
      "Geographic recommendations disabled: topology unreviewed",
    ),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Open recommended site" }),
  ).toBeNull();
});

test("reduced motion disables the flow animation class, including preference changes", () => {
  let change: (() => void) | undefined;
  const media = {
    matches: false,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_name: string, callback: () => void) => {
      change = callback;
    },
    removeEventListener: vi.fn(),
  };
  vi.spyOn(window, "matchMedia").mockReturnValue(
    media as unknown as MediaQueryList,
  );
  const { container } = render(<App initialView="Diagram" />);
  expect(container.querySelectorAll(".reach-flow").length).toBeGreaterThan(0);
  media.matches = true;
  act(() => change?.());
  expect(container.querySelectorAll(".reach-flow").length).toBe(0);
});

test("reviewer demo makes no backend requests while adding, reviewing, conflicting and resetting", async () => {
  const fetch = vi.fn(() =>
      Promise.reject(new Error("Unexpected backend request")),
    ),
    xhr = vi.spyOn(XMLHttpRequest.prototype, "open");
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<App initialView="List" />);
  await user.click(screen.getByRole("button", { name: "Open site 002" }));
  await user.click(screen.getByRole("radio", { name: "Cannot tell" }));
  await user.click(screen.getByRole("button", { name: "Add observation" }));
  const added = within(
    screen.getByRole("article", {
      name: "Added simulated observation at site 002",
    }),
  );
  await user.click(added.getByRole("button", { name: "Mark uncertain" }));
  await user.click(
    screen.getByRole("button", { name: "Load conflicting evidence" }),
  );
  await user.click(screen.getByRole("button", { name: "Reset demo" }));
  expect(screen.getByTestId("candidate-count").textContent).toBe("25");
  expect(fetch).not.toHaveBeenCalled();
  expect(xhr).not.toHaveBeenCalled();
});

test("keyboard view navigation and site opening work without tiles", async () => {
  const user = userEvent.setup();
  render(<App initialView="List" />);
  screen.getByRole("tab", { name: "List" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(
    screen.getByRole("tab", { name: "Diagram" }).getAttribute("aria-selected"),
  ).toBe("true");
  const site = screen.getByRole("button", { name: /Open site 003:/ });
  site.focus();
  await user.keyboard("{Enter}");
  expect(
    screen.getByRole("heading", { name: "Observation site 003" }),
  ).toBeTruthy();
});

test('real Leaflet tile failure suggests the schematic and markers are keyboard labelled',async()=>{
  const L=await import('leaflet');
  let tiles:import('leaflet').TileLayer|undefined;
  const factory=L.default.tileLayer;
  vi.spyOn(L.default,'tileLayer').mockImplementation((...args)=>{tiles=factory(...args);return tiles;});
  const {container}=render(<App/>);
  expect(container.querySelector('[aria-label="Zoom in"]')).toBeTruthy();
  expect(container.querySelector('[aria-label^="Open site 003:"]')).toBeTruthy();
  act(()=>{tiles?.fire('tileerror');});
  expect(screen.getByRole('button',{name:'Use Diagram'})).toBeTruthy();
  const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Use Diagram'}));
  expect(screen.getByRole('group',{name:'Stream network schematic, flowing left to right'})).toBeTruthy();
});
