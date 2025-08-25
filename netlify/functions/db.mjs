import { neon } from "@neondatabase/serverless";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL env var is required");
}
export const sql = neon(DATABASE_URL);

export function getIdentityUser(context) {
  return context?.clientContext?.user || null;
}

export async function ensureUser(user) {
  await sql`
    INSERT INTO app_users (user_id, email)
    VALUES (${user.sub}::uuid, ${user.email})
    ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email
  `;
}
