import { config } from "dotenv";
import { z } from "zod";
config({ quiet: true });
const configSchema = z.object({
  DATABASE_URL: z.url().refine(v => /^postgres(ql)?:/.test(v)),
  JWT_SECRET: z.string().min(32),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).optional(),
  SARVAM_API_KEY: z.string().min(1).optional(),
  AI_DAILY_BUDGET: z.coerce.number().int().min(0).default(200),
  AI_RATE_LIMIT: z.coerce.number().int().min(1).max(1000).default(20),
  CORS_ORIGIN: z.url().refine(v => new URL(v).origin === v && /^https?:/.test(v)),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});
export function readConfig() {
  const result = configSchema.safeParse(process.env);
  if (!result.success) throw new Error("Missing or invalid API environment configuration");
  return result.data;
}
export type ApiConfig = ReturnType<typeof readConfig>;
