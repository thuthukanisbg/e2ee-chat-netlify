import { sql, getIdentityUser } from "./db.mjs";

export async function handler(event, context) {
  try {
    if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };
    const user = getIdentityUser(context);
    if (!user) return { statusCode: 401, body: "Unauthorized" };

    const otherId = (event.queryStringParameters || {}).with;
    const since = (event.queryStringParameters || {}).since;
    if (!otherId) return { statusCode: 400, body: "Query param 'with' is required" };

    let filter = "";
    if (since) filter = ` AND created_at >= '${since}'`;

    const rows = await sql`
      SELECT id, sender_id, recipient_id, ciphertext, nonce, ephemeral_public_key, created_at
      FROM messages
      WHERE ((sender_id = ${user.sub}::uuid AND recipient_id = ${otherId}::uuid)
         OR  (sender_id = ${otherId}::uuid AND recipient_id = ${user.sub}::uuid))
      ORDER BY created_at ASC
      LIMIT 200
    `;
    return { statusCode: 200, body: JSON.stringify(rows) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
