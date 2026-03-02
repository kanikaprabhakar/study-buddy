# Study Buddy Frontend

Next.js App Router frontend with Clerk authentication and Supabase data sync.

## Run locally

```bash
npm install
npm run dev
```

## Required environment variables

Create `.env.local` in `frontend/` with:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
BACKEND_URL=http://localhost:4000
BACKEND_INTERNAL_SYNC_SECRET=...
```

## Clerk → Supabase user sync

User sync now runs in the backend service (Express), not in this frontend app.

Backend webhook endpoint:

- `POST http://localhost:4000/api/webhooks/clerk`

In Clerk Dashboard:

1. Go to **Webhooks**
2. Add endpoint: `http://localhost:4000/api/webhooks/clerk`
3. Subscribe to events:
	- `user.created`
	- `user.updated`
	- `user.deleted`
4. Copy signing secret into backend `.env` as `CLERK_WEBHOOK_SIGNING_SECRET`

## Important schema note

This project supports `users.id` as UUID by storing Clerk IDs in `users.clerk_id` (text, unique).
