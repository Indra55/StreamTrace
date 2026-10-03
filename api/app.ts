import { randomBytes } from "node:crypto";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { SignJWT, jwtVerify } from "jose";
import { hash, verify } from "argon2";
import { z } from "zod";
import type { Pool, PoolClient } from "pg";
import type { ApiConfig } from "./config.ts";
import { withUser } from "./db.ts";
import { loadCase } from "./data.ts";
import { fhirBundle } from "./fhir.ts";
import { makeDraft } from "./draft.ts";

const submission = z.object({ id: z.uuid(), case_id: z.uuid(), signal: z.string().min(1).max(80),
  site_code: z.string().min(1).max(80), value: z.enum(["present", "absent", "cannot_tell"]),
  confirmed: z.literal(true), origin: z.enum(["web", "sms_simulator"]).default("web"),
  observed_at: z.iso.datetime({ offset: true }), notes: z.string().max(500).default("") });
const review = z.object({ report_id: z.uuid(), state: z.enum(["approved", "rejected", "uncertain", "unreviewed"]),
  assumptions_acknowledged: z.boolean(), absence_comparable: z.boolean() }).strict();
const login = z.object({ email: z.email().max(254).transform(s => s.toLowerCase()), password: z.string().min(1).max(1024) }).strict();
const badLogin = { error: "Invalid email or password" };

export async function createApp(pool: Pool, config: ApiConfig, options: { fetcher?: typeof fetch; getIp?: (c: Context) => string } = {}) {
  const app = new Hono();
  const key = new TextEncoder().encode(config.JWT_SECRET);
  const dummyHash = await hash(randomBytes(32).toString("hex"));
  const attempts = new Map<string, { count: number; until: number }>();
  app.use("/api/*", cors({ origin: config.CORS_ORIGIN, credentials: true,
    allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type"] }));
  app.use("/api/*", bodyLimit({ maxSize: 16_384, onError: c => c.json(
    c.req.path === "/api/draft" ? { error: "fallback" } : { error: "Request too large" },
    c.req.path === "/api/draft" ? 502 : 413) }));
  app.use("/api/*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    if (c.req.method === "POST") {
      const origin = c.req.header("Origin");
      if (origin && origin !== config.CORS_ORIGIN) return c.json({ error: "Origin forbidden" }, 403);
      if (!/^application\/json(?:;|$)/i.test(c.req.header("Content-Type") ?? "")) {
        return c.json(c.req.path === "/api/draft" ? { error: "fallback" } : { error: "JSON required" }, c.req.path === "/api/draft" ? 502 : 415);
      }
    }
    await next();
  });
  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "23505") return c.json({ error: "Submission already exists" }, 409);
    if (["23503", "23514", "22P02", "P0001"].includes(String(code))) return c.json({ error: "Invalid request" }, 400);
    if (code === "42501") return c.json({ error: "Reviewer access required" }, 403);
    return c.json({ error: "Service unavailable" }, 500);
  });
  async function reviewer<T>(c: Context, fn: (client: PoolClient, userId: string) => Promise<T>) {
    let userId: string;
    try {
      const token = getCookie(c, "streamtrace_session");
      if (!token) throw new Error("Missing session");
      const result = await jwtVerify(token, key, { algorithms: ["HS256"], issuer: "streamtrace", audience: "streamtrace-api", requiredClaims: ["sub", "exp", "iat"] });
      userId = z.uuid().parse(result.payload.sub);
    } catch { throw new HTTPException(401, { message: "Authentication required" }); }
    return withUser(pool, userId, async client => {
      const allowed = await client.query<{ allowed: boolean }>("select private.is_reviewer() as allowed");
      if (!allowed.rows[0]?.allowed) throw new HTTPException(403, { message: "Reviewer access required" });
      return fn(client, userId);
    });
  }
  app.post("/api/reports", async c => {
    const parsed = submission.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid report" }, 400);
    const r = parsed.data;
    await withUser(pool, null, async client => {
      const site = await client.query(`select 1 from public.sites s join public.cases c on c.network_id=s.network_id
        where s.code=$1 and c.id=$2 and c.signal=$3`, [r.site_code, r.case_id, r.signal]);
      if (!site.rowCount) throw new HTTPException(400, { message: "Unknown site or case signal" });
      await client.query(`insert into public.reports(id,case_id,signal,site_code,value,confirmed,origin,observed_at,notes,review_state)
        values($1,$2,$3,$4,$5,true,$6,$7,$8,'unreviewed')`, [r.id,r.case_id,r.signal,r.site_code,r.value,r.origin,r.observed_at,r.notes]);
    });
    return c.json({ id: r.id, review_state: "unreviewed" }, 201);
  });
  app.get("/api/public/reports", async c => c.json(await withUser(pool, null, async client => {
    const limit = z.coerce.number().int().min(1).max(500).safeParse(c.req.query("limit") ?? "100");
    const offset = z.coerce.number().int().min(0).max(100_000).safeParse(c.req.query("offset") ?? "0");
    if (!limit.success || !offset.success) throw new HTTPException(400, { message: "Invalid pagination" });
    return (await client.query("select id,case_id,site_id,signal,value,observed_on from public.public_reports order by observed_on,id limit $1 offset $2", [limit.data,offset.data])).rows;
  })));
  app.post("/api/login", async c => {
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.until <= now) attempts.delete(ip);
    const ip = options.getIp?.(c) ?? "unknown";
    let entry = attempts.get(ip);
    if (!entry) {
      if (attempts.size >= 10_000) return c.json({ error: "Too many attempts" }, 429);
      entry = { count: 0, until: now + 15 * 60_000 }; attempts.set(ip, entry);
    }
    if (++entry.count > 10) return c.json({ error: "Too many attempts" }, 429);
    const parsed = login.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json(badLogin, 401);
    const user = await withUser(pool, null, async client => (await client.query<{ id: string; password_hash: string }>(
      "select id,password_hash from private.login_user($1)", [parsed.data.email])).rows[0]);
    const valid = await verify(user?.password_hash ?? dummyHash, parsed.data.password).catch(() => false);
    if (!user || !valid) return c.json(badLogin, 401);
    const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(user.id)
      .setIssuer("streamtrace").setAudience("streamtrace-api").setIssuedAt().setExpirationTime("1h").sign(key);
    setCookie(c, "streamtrace_session", token, { httpOnly: true, secure: config.NODE_ENV === "production", sameSite: "Strict", path: "/api", maxAge: 3600 });
    return c.json({ ok: true });
  });
  app.get("/api/reviewer/queue", async c => c.json(await reviewer(c, async client => (
    await client.query(`select r.*,coalesce(d.state,'unreviewed') as current_review_state,coalesce(d.revision,0) as revision
      from public.reports r left join public.review_decisions d on d.report_id=r.id
      where coalesce(d.state,'unreviewed')='unreviewed' order by r.created_at,r.id limit 500`)).rows)));
  app.post("/api/reviews", async c => {
    await reviewer(c, async client => {
      const parsed = review.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) throw new HTTPException(400, { message: "Invalid review" });
      const r = parsed.data;
      const exists = await client.query("select 1 from public.reports where id=$1", [r.report_id]);
      if (!exists.rowCount) throw new HTTPException(404, { message: "Report not found" });
      await client.query("select public.review_report($1,$2,$3,$4)", [r.report_id,r.state,r.assumptions_acknowledged,r.absence_comparable]);
    });
    return c.json({ ok: true });
  });
  app.get("/api/cases/:id/analysis", async c => c.json(await reviewer(c, async client => {
    const id = z.uuid().safeParse(c.req.param("id"));
    if (!id.success) throw new HTTPException(400, { message: "Invalid case ID" });
    return (await loadCase(client, id.data)).analysis;
  })));
  app.post("/api/draft", async c => {
    try { return c.json(await makeDraft(await c.req.json(), config.GROQ_API_KEY, config.GROQ_MODEL, options.fetcher)); }
    catch { return c.json({ error: "fallback" }, 502); }
  });
  app.get("/api/cases/:id/export", async c => {
    const data = await reviewer(c, async client => {
      const id = z.uuid().safeParse(c.req.param("id"));
      if (!id.success) throw new HTTPException(400, { message: "Invalid case ID" });
      return loadCase(client, id.data);
    });
    const format = c.req.query("format") ?? "json";
    if (format === "json") return c.json(data);
    if (format === "fhir") { c.header("Content-Type", "application/fhir+json"); return c.body(JSON.stringify(fhirBundle(data))); }
    return c.json({ error: "Invalid export format" }, 400);
  });
  return app;
}
