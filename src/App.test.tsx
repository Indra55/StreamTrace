import { test, expect, vi } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoApp as App } from "./App.tsx";
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
  expect(screen.getByTestId("candidate-count").textContent).toBe("14");
  await user.click(screen.getByText("Read pending citizen report at site 009"));
  const pending = within(
    screen.getByRole("article", {
      name: "Pending citizen demo report at site 009",
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
  expect(screen.getByTestId("candidate-count").textContent).toBe("7");
  await user.click(pending.getByRole("button", { name: "Withdraw" }));
  expect(screen.getByTestId("candidate-count").textContent).toBe("14");
  expect(screen.getByText(/Demo withdrew approval/)).toBeTruthy();
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
  render(
    <App
      data={{
        ...network,
        metadata: {
          ...network.metadata,
          topology_review_state: "unreviewed",
          geographic_recommendations_enabled: false,
        },
      }}
      initialView="Diagram"
    />,
  );
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

test("interactive demo makes no network requests while adding, reviewing, conflicting and resetting", async () => {
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
  await user.click(screen.getByText("Read pending citizen report at site 002"));
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
  expect(screen.getByTestId("candidate-count").textContent).toBe("14");
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

test("the demo map creates no tile layer or network requests", async () => {
  const L = await import("leaflet");
  const tiles = vi.spyOn(L.default, "tileLayer");
  const background = vi.spyOn(L.default, "imageOverlay");
  const fetch = vi.fn();
  const xhr = vi.spyOn(XMLHttpRequest.prototype, "open");
  vi.stubGlobal("fetch", fetch);
  const { container } = render(<App />);
  expect(container.querySelector('[aria-label="Zoom in"]')).toBeTruthy();
  expect(container.querySelector('[aria-label^="Open site 003:"]')).toBeTruthy();
  expect(background).toHaveBeenCalledWith(expect.any(String), expect.any(Array), expect.objectContaining({pane:"bundled-basemap",interactive:false,alt:"Study-area roads, waterways and place names"}));
  expect(container.querySelector(".leaflet-image-layer")?.getAttribute("src")).toBeTruthy();
  expect(screen.getByText("Bundled study-area map")).toBeTruthy();
  expect(tiles).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(xhr).not.toHaveBeenCalled();
});

test("guided tour follows reading, approval, narrowing, next-site opening and reset", async () => {
  const user = userEvent.setup();
  render(<App initialView="Diagram" />);
  expect(document.querySelector<HTMLDetailsElement>(".history")?.open).toBe(false);
  expect(document.querySelector<HTMLDetailsElement>(".model-assumptions")?.open).toBe(false);
  await user.click(screen.getByText("Guided tour"));
  await user.click(screen.getByRole("button", { name: /Read the pending citizen report/ }));
  expect(screen.getByText("1 of 4 steps complete.")).toBeTruthy();
  expect(document.querySelector(".pending-report.tour-highlight")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Approve it with the assumptions shown/ }));
  const card = within(screen.getByRole("article", { name: "Pending citizen demo report at site 009" }));
  await user.click(card.getByLabelText("I acknowledge the case assumptions"));
  await user.click(card.getByLabelText("Absence is comparable, persistent and detectable"));
  await user.click(card.getByRole("button", { name: "Approve" }));
  expect(screen.getByTestId("candidate-count").textContent).toBe("7");
  expect(screen.getByText("3 of 4 steps complete.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Watch the candidate count drop/ }));
  expect(screen.getByRole("tab", { name: "Map" }).getAttribute("aria-selected")).toBe("true");
  await user.click(screen.getByRole("button", { name: /Open the recommended next site/ }));
  expect(screen.getByRole("button", { name: "Open recommended site" }).className).toBe("tour-highlight");
  await user.click(screen.getByRole("button", { name: "Open recommended site" }));
  expect(screen.getByText("4 of 4 steps complete.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Optional: see what happens/ }));
  await user.click(screen.getByRole("button", { name: "Load conflicting evidence" }));
  expect(screen.getByTestId("candidate-count").textContent).toBe("0");
  await user.click(screen.getByRole("button", { name: "Reset demo" }));
  expect(screen.getByText("0 of 4 steps complete.")).toBeTruthy();
  expect(screen.getByTestId("candidate-count").textContent).toBe("14");
});
