import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import VoiceInput from "./VoiceInput.tsx";
import Routes from "../Routes.tsx";
import { setDemoMode } from "./navigation.tsx";

function recorder() {
  const stopTrack = vi.fn(), getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }));
  vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });
  class Recorder {
    static isTypeSupported() { return true; }
    state = "inactive"; mimeType = "audio/webm;codecs=opus";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null; onerror: (() => void) | null = null;
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["fake audio"]) }); this.onstop?.(); }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  return { getUserMedia, stopTrack };
}
test.each(["/report?mode=demo", "/play?mode=live"])("%s inserts editable simulated transcription without recording or network calls", async path => {
  for (const name of ["localStorage", "sessionStorage"]) {
    const data = new Map<string, string>();
    vi.stubGlobal(name, { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
  }
  setDemoMode(false); history.replaceState(null, "", path);
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const { getUserMedia } = recorder(); render(<Routes/>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Site 003" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Seen" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Try voice (simulated)" }));
  const textbox = screen.getByRole("textbox", { name: /Describe it/ }) as HTMLTextAreaElement;
  expect(textbox.value).toBe("I can see foam floating on the water at this site.");
  expect(screen.getByText("Simulated transcription, please check")).toBeTruthy();
  await user.type(textbox, " I checked again.");
  await user.click(screen.getByRole("button", { name: "Check my report" }));
  expect(screen.getByRole("heading", { name: "Is this what you observed?" })).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled(); expect(getUserMedia).not.toHaveBeenCalled();
});
test("recording counts down, stops tracks and sends multipart audio with an editable transcript", async () => {
  const { stopTrack } = recorder(), onTranscript = vi.fn(), busy = vi.fn();
  const fetch = vi.fn(async (_url: unknown, options: RequestInit) => {
    expect(options.body).toBeInstanceOf(FormData);
    expect(new Headers(options.headers).has("Content-Type")).toBe(false);
    return Response.json({ transcript: "I see dead fish." });
  }); vi.stubGlobal("fetch", fetch);
  render(<VoiceInput simulated={false} cannedTranscript="unused" onTranscript={onTranscript} onBusyChange={busy}/>);
  const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Use microphone" }));
  expect(screen.getByText("Recording: 25 s remaining. Tap to stop.")).toBeTruthy();
  expect(await screen.findByText("Recording: 24 s remaining. Tap to stop.", {}, { timeout: 2000 })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Stop recording" }));
  await waitFor(() => expect(onTranscript).toHaveBeenCalledWith("I see dead fish."));
  expect(stopTrack).toHaveBeenCalled(); expect(busy).toHaveBeenLastCalledWith(false);
});
test("provider failure keeps typing usable and permission denial disables recording with an explanation", async () => {
  const { getUserMedia } = recorder(), onTranscript = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "fallback" }, { status: 502 })));
  render(<VoiceInput simulated={false} cannedTranscript="unused" onTranscript={onTranscript} onBusyChange={vi.fn()}/>);
  const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Use microphone" }));
  await user.click(screen.getByRole("button", { name: "Stop recording" }));
  expect(await screen.findByText("Voice unavailable, please type instead")).toBeTruthy(); expect(onTranscript).not.toHaveBeenCalled();
  getUserMedia.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
  await user.click(screen.getByRole("button", { name: "Use microphone" }));
  expect(await screen.findByText(/Microphone permission denied/)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Use microphone" }) as HTMLButtonElement).disabled).toBe(true);
});
