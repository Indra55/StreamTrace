import { z } from "zod";

export const maxAudioBytes = 1_500_000;
export const maxAudioRequestBytes = maxAudioBytes + 16_384;
// Sarvam REST accepts these MediaRecorder containers, including Opus in WebM/Ogg.
const formats: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/opus": "opus" };

export async function transcribe(request: Request, key?: string, fetcher: typeof fetch = fetch): Promise<{ transcript: string }> {
  if (!key) throw new Error("Voice unavailable");
  const incoming = await request.formData();
  const file = incoming.get("file");
  if (!(file instanceof File) || !file.size || file.size > maxAudioBytes || [...incoming.keys()].length !== 1) throw new Error("Invalid audio");
  const mime = file.type.split(";")[0]!.toLowerCase(), extension = formats[mime];
  if (!extension) throw new Error("Unsupported audio");
  const body = new FormData();
  body.set("model", "saaras:v3");
  // Discard the supplied filename and MIME parameters. Keep audio in memory only.
  body.set("file", new Blob([await file.arrayBuffer()], { type: mime }), `recording.${extension}`);
  const signal = AbortSignal.timeout(10_000);
  const response = await fetcher("https://api.sarvam.ai/speech-to-text", {
    method: "POST", headers: { "api-subscription-key": key }, body, signal,
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error("Voice unavailable"); }
  const result = z.object({ transcript: z.string().trim().min(1).max(500) }).parse(await response.json());
  return { transcript: result.transcript };
}
