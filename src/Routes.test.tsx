import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import Routes from "./Routes.tsx";
import { navigate, setDemoMode } from "./citizen/navigation.tsx";
import { resetDemo } from "./citizen/demo-store.ts";
import { network } from "./demo.ts";

beforeEach(() => {
  history.replaceState(null, "", "/");
  setDemoMode(false);
  resetDemo();
});

test("one header contains each destination once and no task or Home navigation", () => {
  render(<Routes/>);
  expect(screen.getAllByRole("banner")).toHaveLength(1);
  const header = within(screen.getByRole("banner"));
  expect(header.getAllByRole("link").map(link => [link.textContent?.split("Field atlas")[0], link.getAttribute("href")])).toEqual([
    ["StreamTrace", "/"], ["How it works", "/#how-it-works"], ["Report", "/report"], ["Demo", "/demo"], ["Reviewer sign in", "/login"],
  ]);
  expect(header.queryByText("Home")).toBeNull();
  expect(header.queryByText("Next field task")).toBeNull();
  expect(header.queryByText("Live")).toBeNull();
  expect(header.queryByText("Demo (simulated)")).toBeNull();
});

test("How it works returns to the landing section and focuses it", async () => {
  history.replaceState(null, "", "/login");
  render(<Routes/>);
  await userEvent.setup().click(screen.getByRole("link", { name: "How it works" }));
  expect(location.pathname + location.hash).toBe("/#how-it-works");
  expect(document.activeElement?.id).toBe("how-it-works");
});

test("the mobile menu exposes its expanded state and Escape returns focus", async () => {
  render(<Routes/>);
  const user = userEvent.setup(), button = screen.getByRole("button", { name: "Menu" });
  expect(button.getAttribute("aria-expanded")).toBe("false");
  await user.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("true");
  screen.getByRole("link", { name: "Report" }).focus();
  await user.keyboard("{Escape}");
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(button);
});

test.each(["/review", "/review?mode=demo"])("unauthenticated %s redirects to login even after using the demo", async path => {
  setDemoMode(true);
  history.replaceState(null, "", path);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Authentication required" }, { status: 401 })));
  render(<Routes/>);
  await screen.findByRole("button", { name: "Sign in" });
  expect(location.pathname).toBe("/login");
  expect(screen.queryByTestId("candidate-count")).toBeNull();
  expect(screen.queryByRole("button", { name: "Reset demo" })).toBeNull();
});

test("demo navigation and every network view stay offline", async () => {
  const fetch = vi.fn(), xhr = vi.spyOn(XMLHttpRequest.prototype, "open");
  vi.stubGlobal("fetch", fetch);
  history.replaceState(null, "", "/demo");
  render(<Routes/>);
  expect(screen.getByText("Demo (simulated)")).toBeTruthy();
  expect(screen.getByRole("note").textContent).toBe("Demo mode: simulated data, nothing is saved or sent.");
  const user = userEvent.setup();
  for (const view of ["List", "Diagram", "Map"]) await user.click(screen.getByRole("tab", { name: view }));
  await user.click(screen.getByRole("button", { name: "Load conflicting evidence" }));
  await user.click(screen.getByRole("button", { name: "Reset demo" }));
  expect(fetch).not.toHaveBeenCalled();
  expect(xhr).not.toHaveBeenCalled();
});

test("login contains only email and password, reports failed credentials, and links to the demo", async () => {
  history.replaceState(null, "", "/login");
  const fetch = vi.fn(async () => Response.json({ error: "Invalid credentials" }, { status: 401 }));
  vi.stubGlobal("fetch", fetch);
  render(<Routes/>);
  expect(fetch).not.toHaveBeenCalled();
  expect(document.querySelectorAll("form input")).toHaveLength(2);
  expect(screen.queryByRole("button", { name: /sign up/i })).toBeNull();
  expect(screen.getByRole("link", { name: "Open the interactive demo" }).getAttribute("href")).toBe("/demo");
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "reviewer@example.invalid");
  await user.type(screen.getByLabelText("Password"), "wrong-password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Email or password is incorrect. Try again.");
});

test("the reviewer area filters simulated cases and starts with the live queue", async () => {
  const real = { id: "10000000-0000-4000-8000-000000000001", signal: "foam", assumptions: "Fixture", network_id: "fixture", simulated: false };
  const simulated = { ...real, id: "10000000-0000-4000-8000-000000000002", signal: "Simulated test case", simulated: true };
  const fetch = vi.fn(async (path: RequestInfo | URL) => {
    if (String(path) === "/api/reviewer/cases") return Response.json([simulated, real]);
    if (String(path) === "/api/reviewer/queue") return Response.json([]);
    return Response.json({ case: real, graph: network, reports: [], decisions: [], events: [], analysis: { candidates: [], steps: [], checkedSites: [], status: "awaiting_review", recommendation: null, message: "Awaiting review" } });
  });
  vi.stubGlobal("fetch", fetch);
  history.replaceState(null, "", `/review?case=${simulated.id}`);
  render(<Routes/>);
  expect(await screen.findByRole("heading", { name: "Pending reports" })).toBeTruthy();
  expect(screen.getByText("Live mode")).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Queue" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.queryByRole("heading", { name: "Stream map" })).toBeNull();
  expect(screen.queryByText("Simulated test case")).toBeNull();
  expect(fetch.mock.calls.some(([path]) => String(path).includes(simulated.id))).toBe(false);
});

test("a stale live case marked simulated is rejected before rendering evidence", async () => {
  const real = { id: "10000000-0000-4000-8000-000000000001", signal: "foam", assumptions: "Fixture", network_id: "fixture", simulated: false };
  vi.stubGlobal("fetch", vi.fn(async (path: RequestInfo | URL) => {
    if (String(path) === "/api/reviewer/cases") return Response.json([real]);
    if (String(path) === "/api/reviewer/queue") return Response.json([]);
    return Response.json({ case: { ...real, simulated: true }, graph: network, reports: [], decisions: [], events: [], analysis: { candidates: [], steps: [], checkedSites: [], status: "awaiting_review", recommendation: null, message: "Awaiting review" } });
  }));
  act(() => navigate("/review"));
  render(<Routes/>);
  expect((await screen.findByRole("alert")).textContent).toBe("Only live cases are available in the reviewer area.");
  expect(screen.queryByTestId("candidate-count")).toBeNull();
});
