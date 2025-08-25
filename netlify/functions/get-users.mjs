import { sql, getIdentityUser } from "./db.mjs";

export async function handler(event, context) {
  try {
    if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };
    const user = getIdentityUser(context);
    if (!user) return { statusCode: 401, body: "Unauthorized" };

    const rows = await sql`
      SELECT u.user_id, u.email, k.public_key
      FROM app_users u
      LEFT JOIN user_keys k ON k.user_id = u.user_id
      ORDER BY u.email ASC
    `;
    return { statusCode: 200, body: JSON.stringify(rows) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
