import { hash } from "argon2";
import { adminTransaction } from "./migrate.ts";

async function run() {
  const email = "admin@email.com";
  const password = "pass123";
  const passwordHash = await hash(password);
  
  await adminTransaction(async client => {
    const result = await client.query(`insert into public.users(email,password_hash) values($1,$2)
      on conflict(email) do update set password_hash=excluded.password_hash returning id`, [email, passwordHash]);
    await client.query("insert into public.reviewers(user_id) values($1) on conflict do nothing", [result.rows[0].id]);
    console.log("Created admin user:", email);
  });
}
run().catch(console.error);
