import { sql, getIdentityUser, ensureUser } from "./db.mjs";

export async function handler(event, context) {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
    const user = getIdentityUser(context);
    if (!user) return { statusCode: 401, body: "Unauthorized" };

    const { publicKey, encryptedPrivateKey } = JSON.parse(event.body || "{}");
    if (!publicKey) return { statusCode: 400, body: "publicKey is required" };

    await ensureUser(user);
    await sql`
      INSERT INTO user_keys (user_id, public_key, encrypted_private_key)
      VALUES (${user.sub}::uuid, ${publicKey}, ${encryptedPrivateKey || null})
      ON CONFLICT (user_id) DO UPDATE SET
        public_key = EXCLUDED.public_key,
        encrypted_private_key = EXCLUDED.encrypted_private_key,
        updated_at = NOW()
    `;
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
