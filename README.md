# E2EE Chat — Netlify + Functions + Neon

- Frontend: React + Vite
- Auth: Netlify Identity
- Backend: Netlify Functions (Node 18+)
- DB: Neon Postgres (ciphertext only)

## Deploy (summary)
1) Import repo to Netlify from Git.
2) Enable **Identity** in Site settings.
3) Add env var `DATABASE_URL` with your Neon URL.
4) Deploy. Log in and chat.
