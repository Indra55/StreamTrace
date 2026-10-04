import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { request } from "../api.ts";

const formats = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm", "audio/ogg"];
const maxBytes = 1_500_000;
type Phase = "idle" | "permission" | "recording" | "transcribing";
export default function VoiceInput({ simulated, cannedTranscript, onTranscript, onBusyChange }: {
  simulated: boolean; cannedTranscript: string; onTranscript: (text: string) => void; onBusyChange: (busy: boolean) => void;
}) {
  const id = useId(), [phase, setPhase] = useState<Phase>("idle"), [remaining, setRemaining] = useState(25);
  const [explanation, setExplanation] = useState(""), [message, setMessage] = useState("");
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]), size = useRef(0), mounted = useRef(true), failed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), ticker = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const controller = useRef<AbortController | null>(null), pending = useRef(false);
  function release() {
    clearTimeout(timer.current); clearInterval(ticker.current);
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
  }
  useEffect(() => {
    mounted.current = true;
    if (!simulated && (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined" || !formats.some(format => MediaRecorder.isTypeSupported(format)))) {
      setExplanation("Voice recording is unsupported in this browser. Please type instead. A secure connection is required.");
    }
    return () => {
      mounted.current = false; controller.current?.abort();
      if (recorder.current) { recorder.current.onstop = null; recorder.current.ondataavailable = null; recorder.current.onerror = null; if (recorder.current.state !== "inactive") recorder.current.stop(); }
      release(); chunks.current = []; pending.current = false;
    };
  }, [simulated]);
  function finish() {
    clearTimeout(timer.current); clearInterval(ticker.current);
    if (recorder.current?.state !== "inactive") recorder.current?.stop();
    release();
  }
  async function upload(mime: string) {
    release();
    try {
      if (failed.current || !size.current || size.current > maxBytes) throw new Error("Invalid recording");
      setPhase("transcribing");
      const body = new FormData(), type = mime.split(";")[0]!;
      body.set("file", new Blob(chunks.current, { type }), `recording.${type === "audio/mp4" ? "m4a" : type === "audio/ogg" ? "ogg" : "webm"}`);
      chunks.current = [];
      controller.current = new AbortController();
      const timeout = setTimeout(() => controller.current?.abort(), 12_000);
      try {
        const result = z.object({ transcript: z.string().trim().min(1).max(500) }).strict().parse(await request("/api/transcribe", { method: "POST", body, signal: controller.current.signal }));
        if (mounted.current) { onTranscript(result.transcript); setMessage("Transcription ready. Please check and edit the text."); }
      } finally { clearTimeout(timeout); }
    } catch { if (mounted.current) setMessage("Voice unavailable, please type instead"); }
    finally { chunks.current = []; size.current = 0; pending.current = false; if (mounted.current) { setPhase("idle"); onBusyChange(false); } }
  }
  async function start() {
    if (simulated) { onTranscript(cannedTranscript); setMessage("Simulated transcript inserted. No recording or network request is made."); return; }
    if (pending.current || explanation) return;
    pending.current = true; setMessage(""); setPhase("permission"); onBusyChange(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mimeType = formats.find(format => MediaRecorder.isTypeSupported(format))!;
      const recording = new MediaRecorder(media, { mimeType, audioBitsPerSecond: 64_000 }); recorder.current = recording;
      chunks.current = []; size.current = 0; failed.current = false;
      recording.ondataavailable = event => { chunks.current.push(event.data); size.current += event.data.size; if (size.current > maxBytes) { failed.current = true; finish(); } };
      recording.onstop = () => { if (mounted.current) void upload(recording.mimeType || mimeType); };
      recording.onerror = () => { failed.current = true; finish(); };
      recording.start(250); setPhase("recording"); setRemaining(25);
      const deadline = Date.now() + 25_000;
      ticker.current = setInterval(() => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 250);
      timer.current = setTimeout(finish, 25_000);
    } catch (error) {
      release(); pending.current = false;
      if (!mounted.current) return;
      if (error && typeof error === "object" && "name" in error && ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(String(error.name))) setExplanation("Microphone permission denied. Please type instead. You can enable microphone access in your browser settings.");
      setMessage("Voice unavailable, please type instead"); setPhase("idle"); onBusyChange(false);
    }
  }
  return <div className="voice-input">
    <button type="button" className="voice-button" aria-describedby={id} aria-pressed={phase === "recording"} disabled={!!explanation || phase === "permission" || phase === "transcribing"} onClick={() => phase === "recording" ? finish() : void start()}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>
      {phase === "recording" ? "Stop recording" : phase === "transcribing" ? "Transcribing..." : phase === "permission" ? "Waiting for microphone..." : simulated ? "Try voice (simulated)" : "Use microphone"}
    </button>
    <p id={id} className="voice-consent">{simulated ? "Simulated voice input. No recording is made or sent." : "Your voice recording is sent to a speech-to-text service and not stored."}</p>
    <p className="voice-status" role="status" aria-live="polite" aria-atomic="true">{explanation || (phase === "recording" ? `Recording: ${remaining} s remaining. Tap to stop.` : phase === "transcribing" ? "Transcribing..." : phase === "permission" ? "Waiting for microphone permission..." : message)}</p>
  </div>;
}
