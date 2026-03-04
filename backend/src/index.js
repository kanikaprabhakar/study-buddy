import "dotenv/config";
import dns from "node:dns";
import cors from "cors";
import express from "express";
import { Webhook } from "svix";
import { verifyToken } from "@clerk/backend";
import sql from "./supabase.js";

dns.setDefaultResultOrder("ipv4first");

const app = express();
const port = Number(process.env.PORT || 4000);
const webhookSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
const internalSyncSecret = process.env.BACKEND_INTERNAL_SYNC_SECRET;

async function upsertClerkUser(user) {
	const emailList = user.email_addresses ?? [];
	const primaryEmail =
		emailList.find((item) => item.id === user.primary_email_address_id)?.email_address ??
		emailList[0]?.email_address ??
		null;

	const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
	const displayName = fullName || user.username || "Study Buddy User";

	if (primaryEmail) {
		await sql`
			update public.users
			set clerk_id = ${user.id}, name = ${displayName}
			where email = ${primaryEmail}
				and (clerk_id is null or clerk_id <> ${user.id})
		`;
	}

	await sql`
		insert into public.users (clerk_id, name, email)
		values (${user.id}, ${displayName}, ${primaryEmail})
		on conflict (clerk_id)
		do update set
			name = excluded.name,
			email = excluded.email
	`;
}

async function ensureUsersSchema() {
	await sql`create extension if not exists pgcrypto`;

	await sql`
		alter table public.users
		add column if not exists clerk_id text
	`;

	await sql`
		alter table public.users
		alter column id set default gen_random_uuid()
	`;

	await sql`
		create unique index if not exists users_clerk_id_key
		on public.users (clerk_id)
	`;
}

/* ── Clerk JWT auth ── */
async function requireAuth(req, res) {
	const auth = req.headers.authorization ?? "";
	if (!auth.startsWith("Bearer ")) {
		res.status(401).json({ error: "Missing Bearer token" });
		return null;
	}
	try {
		const payload = await verifyToken(auth.slice(7), {
			secretKey: process.env.CLERK_SECRET_KEY,
		});
		return payload.sub; // clerk user id
	} catch {
		res.status(401).json({ error: "Invalid token" });
		return null;
	}
}

/* ── Tasks schema ── */
async function ensureTasksSchema() {
	await sql`
		create table if not exists public.tasks (
			id         uuid primary key default gen_random_uuid(),
			clerk_id   text not null,
			title      text not null,
			deadline   date,
			priority   text not null default 'medium',
			done       boolean not null default false,
			created_at timestamptz not null default now()
		)
	`;
	await sql`
		create index if not exists tasks_clerk_id_idx on public.tasks (clerk_id)
	`;
}

app.use(cors());

app.get("/health", (_req, res) => {
	res.status(200).json({ ok: true, service: "study-buddy-backend" });
});

app.post("/api/internal/sync-user", express.json(), async (req, res) => {
	if (!internalSyncSecret) {
		return res.status(500).json({ error: "Missing BACKEND_INTERNAL_SYNC_SECRET" });
	}

	if (req.headers["x-sync-secret"] !== internalSyncSecret) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	const user = req.body?.user;

	if (!user?.id) {
		return res.status(400).json({ error: "Missing user payload" });
	}

	try {
		await upsertClerkUser(user);
		return res.status(200).json({ ok: true });
	} catch (error) {
		console.error("Internal sync failed:", error);
		return res.status(500).json({ error: "Database sync failed" });
	}
});

app.post("/api/webhooks/clerk", express.raw({ type: "application/json" }), async (req, res) => {
	if (!webhookSecret) {
		return res.status(500).json({
			error: "Missing CLERK_WEBHOOK_SIGNING_SECRET in backend .env",
		});
	}

	const svixId = req.headers["svix-id"];
	const svixTimestamp = req.headers["svix-timestamp"];
	const svixSignature = req.headers["svix-signature"];

	if (!svixId || !svixTimestamp || !svixSignature) {
		return res.status(400).json({ error: "Missing Svix headers" });
	}

	let event;

	try {
		const body = req.body.toString();
		const wh = new Webhook(webhookSecret);

		event = wh.verify(body, {
			"svix-id": String(svixId),
			"svix-timestamp": String(svixTimestamp),
			"svix-signature": String(svixSignature),
		});
	} catch (error) {
		console.error("Invalid Clerk webhook signature:", error);
		return res.status(400).json({ error: "Invalid webhook signature" });
	}

	try {
		if (event.type === "user.created" || event.type === "user.updated") {
			await upsertClerkUser(event.data);
		}

		if (event.type === "user.deleted") {
			const userId = event.data?.id;

			if (userId) {
				await sql`delete from public.users where clerk_id = ${userId}`;
			}
		}

		return res.status(200).json({ ok: true });
	} catch (error) {
		console.error("Failed syncing Clerk user to DB:", error);
		return res.status(500).json({ error: "Database sync failed" });
	}
});

app.use(express.json());

/* ── Tasks CRUD ── */

// GET /api/tasks — list all tasks for the auth'd user
app.get("/api/tasks", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	try {
		const rows = await sql`
			select id, title, deadline, priority, done, created_at as "createdAt"
			from public.tasks
			where clerk_id = ${clerkId}
			order by created_at asc
		`;
		res.json(rows);
	} catch (err) {
		console.error("GET /api/tasks:", err);
		res.status(500).json({ error: "Database error" });
	}
});

// POST /api/tasks — create a new task
app.post("/api/tasks", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { title, deadline, priority = "medium" } = req.body ?? {};
	if (!title?.trim()) return res.status(400).json({ error: "title is required" });
	try {
		const [row] = await sql`
			insert into public.tasks (clerk_id, title, deadline, priority)
			values (${clerkId}, ${title.trim()}, ${deadline ?? null}, ${priority})
			returning id, title, deadline, priority, done, created_at as "createdAt"
		`;
		res.status(201).json(row);
	} catch (err) {
		console.error("POST /api/tasks:", err);
		res.status(500).json({ error: "Database error" });
	}
});

// PATCH /api/tasks/:id — update a task (partial)
app.patch("/api/tasks/:id", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { id } = req.params;
	const body = req.body ?? {};
	try {
		// Fetch existing to merge
		const [existing] = await sql`
			select * from public.tasks where id = ${id} and clerk_id = ${clerkId}
		`;
		if (!existing) return res.status(404).json({ error: "Task not found" });

		const title    = body.title    !== undefined ? body.title.trim()        : existing.title;
		const deadline = body.deadline !== undefined ? (body.deadline || null)   : existing.deadline;
		const priority = body.priority !== undefined ? body.priority             : existing.priority;
		const done     = body.done     !== undefined ? Boolean(body.done)        : existing.done;

		const [row] = await sql`
			update public.tasks
			set title = ${title}, deadline = ${deadline}, priority = ${priority}, done = ${done}
			where id = ${id} and clerk_id = ${clerkId}
			returning id, title, deadline, priority, done, created_at as "createdAt"
		`;
		res.json(row);
	} catch (err) {
		console.error("PATCH /api/tasks:", err);
		res.status(500).json({ error: "Database error" });
	}
});

// DELETE /api/tasks/:id — remove a task
app.delete("/api/tasks/:id", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { id } = req.params;
	try {
		await sql`delete from public.tasks where id = ${id} and clerk_id = ${clerkId}`;
		res.status(204).end();
	} catch (err) {
		console.error("DELETE /api/tasks:", err);
		res.status(500).json({ error: "Database error" });
	}
});

Promise.all([ensureUsersSchema(), ensureTasksSchema()])
	.then(() => {
		app.listen(port, () => {
			console.log(`Study Buddy backend running on http://localhost:${port}`);
		});
	})
	.catch((error) => {
		console.error("Failed to prepare schema:", error);
		console.error(
			"Backend is running, but DB sync is disabled until DATABASE_URL is fixed in backend/.env"
		);

		app.listen(port, () => {
			console.log(`Study Buddy backend running on http://localhost:${port}`);
		});
	});
