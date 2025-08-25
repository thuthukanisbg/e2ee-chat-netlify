import { sql, getIdentityUser } from "./db.mjs";

export async function handler(event, context) {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
    const user = getIdentityUser(context);
    if (!user) return { statusCode: 401, body: "Unauthorized" };

    const { recipientId, ciphertext, nonce, ephemeralPublicKey } = JSON.parse(event.body || "{}");
    if (!recipientId || !ciphertext || !nonce || !ephemeralPublicKey) {
      return { statusCode: 400, body: "recipientId, ciphertext, nonce, ephemeralPublicKey are required" };
    }
    await sql`
      INSERT INTO messages (sender_id, recipient_id, ciphertext, nonce, ephemeral_public_key)
      VALUES (${user.sub}::uuid, ${recipientId}::uuid, ${ciphertext}, ${nonce}, ${ephemeralPublicKey})
    `;
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
