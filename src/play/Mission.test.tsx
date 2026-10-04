import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Mission from "./Mission.tsx";
import { useAutoplay } from "./drivers.ts";
import { createMission, newForm, submitReport } from "./model.ts";

vi.mock("../useReducedMotion.ts", () => ({ useReducedMotion: () => true }));
vi.mock("./effects.tsx", () => ({
  River: () => null,
  Count: ({ value }: { value: number }) => <strong>{value}</strong>,
  useSound: () => ({ ping: vi.fn(), toggle: vi.fn(), enabled: false }),
}));
vi.mock("../components/StreamMap.tsx", () => ({ StreamMap: () => <div>Stream map</div> }));

beforeEach(() => {
  history.replaceState(null, "", "/play");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

test("the opening starts immediately and later chapters have separate introductions", async () => {
  render(<Mission/>);
  const user = userEvent.setup();
  expect(document.querySelector(".opening-scene")).toBeTruthy();
  expect(screen.queryByText("What happens here")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Why your observation matters" }));
  expect(screen.getByRole("heading", { name: "A shared investigation" })).toBeTruthy();
  expect(document.querySelector(".process-scene")).toBeNull();

  await user.click(screen.getByRole("button", { name: "Begin chapter" }));
  expect(document.querySelector(".process-scene")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Follow the foam" }));
  expect(screen.getByRole("heading", { name: "You are the citizen" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Submit simulated report" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "Begin chapter" }));
  expect((screen.getByRole("button", { name: "Submit simulated report" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText("What happens here")).toBeNull();
  expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
});

test("skipping the opening shows the next intro and restart replays the opening", async () => {
  render(<Mission/>);
  const user = userEvent.setup();
  expect(document.querySelector(".opening-scene")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Skip chapter" }));
  expect(screen.getByRole("heading", { name: "A shared investigation" })).toBeTruthy();
  await user.click(screen.getByLabelText("Mission options"));
  await user.click(screen.getByRole("button", { name: "Restart" }));
  expect(screen.queryByRole("button", { name: "Begin chapter" })).toBeNull();
  expect(document.querySelector(".opening-scene")).toBeTruthy();
});

test("autoplay waits six seconds without actions, then starts a fresh activity timer", () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  const step = vi.fn(() => true), finished = vi.fn();
  const { result } = renderHook(() => {
    const [intro, setIntro] = useState(true);
    useAutoplay({ enabled: true, reduced: false, speed: 1, chapter: 2, intro,
      step, ready: () => true, advance: () => intro ? setIntro(false) : finished() });
    return intro;
  });
  act(() => vi.advanceTimersByTime(5900));
  expect(result.current).toBe(true);
  expect(step).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(100));
  expect(result.current).toBe(false);
  expect(step).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(39000));
  expect(step).toHaveBeenCalled();
  expect(finished).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1000));
  expect(finished).toHaveBeenCalledOnce();
});


test.each(["cannot_tell", "present", "absent"] as const)("reviewing %s explains the approval rules", async value => {
  const state = submitReport(createMission(), { ...newForm("007", value), text: "My field observation", confirmed: true }, "Player report");
  render(<Mission initialState={state} />);
  const user = userEvent.setup();
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByRole("button", { name: "Skip chapter" }));
    await user.click(screen.getByRole("button", { name: "Begin chapter" }));
  }
  const approve = screen.getByRole("button", { name: "Approve", exact: true }) as HTMLButtonElement;
  expect(approve.disabled).toBe(true);
  expect(screen.getAllByText("My field observation")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Citizen context" }).getAttribute("aria-expanded")).toBe("false");
  const before = document.querySelector(".mission-count strong")!.textContent;
  if (value === "cannot_tell") {
    expect(screen.queryByLabelText("I acknowledge the case assumptions")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Mark uncertain", exact: true }));
    expect(screen.getByText(/Marked uncertain/)).toBeTruthy();
    expect(document.querySelector(".mission-count strong")!.textContent).toBe(before);
  } else {
    await user.click(screen.getByLabelText("I acknowledge the case assumptions"));
    if (value === "absent") {
      expect(approve.disabled).toBe(true);
      await user.click(screen.getByLabelText("Absence is comparable, persistent and detectable"));
      expect(approve.disabled).toBe(true);
      await user.type(screen.getByRole("textbox"), "Visible throughout the field check.");
    }
    expect(approve.disabled).toBe(false);
    await user.click(approve);
    expect(screen.getByText(/Approved. The investigation/)).toBeTruthy();
    expect(document.querySelector(".mission-count strong")!.textContent).not.toBe(before);
  }
  expect((screen.getByRole("button", { name: "Continue", exact: true }) as HTMLButtonElement).disabled).toBe(false);
});
