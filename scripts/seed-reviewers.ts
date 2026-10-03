import { z } from "zod";
import { hash } from "argon2";
import { pathToFileURL } from "node:url";
import { adminTransaction } from "./migrate.ts";

export async function seedReviewers(test = false): Promise<void> {
  if (!process.argv.includes("--confirm")) throw new Error("Seed requires --confirm");
  const emails = z.array(z.email().transform(s => s.toLowerCase())).min(1).parse(JSON.parse(process.env.REVIEWER_EMAILS ?? "null"));
  const passwords = z.array(z.string().min(12).max(1024)).parse(JSON.parse(process.env.REVIEWER_PASSWORDS ?? "null"));
  if (emails.length !== passwords.length || new Set(emails).size !== emails.length) throw new Error("Invalid reviewer seed configuration");
  const hashes = await Promise.all(passwords.map(p => hash(p)));
  await adminTransaction(async client => {
    for (let i=0; i<emails.length; i++) {
      const result = await client.query<{ id: string }>(`insert into public.users(email,password_hash) values($1,$2)
        on conflict(email) do update set password_hash=excluded.password_hash returning id`, [emails[i],hashes[i]]);
      await client.query("insert into public.reviewers(user_id) values($1) on conflict do nothing", [result.rows[0]!.id]);
    }
  }, test);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedReviewers(process.argv.includes("--test")).then(() => console.log("Reviewer seed complete"))
    .catch(() => { console.error("Reviewer seed refused or failed; confirm explicitly and supply credentials through the environment"); process.exitCode=1; });
}
