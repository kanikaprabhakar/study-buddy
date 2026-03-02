import "dotenv/config";
import dns from "node:dns";
import cors from "cors";
import express from "express";
import { Webhook } from "svix";
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

ensureUsersSchema()
	.then(() => {
		app.listen(port, () => {
			console.log(`Study Buddy backend running on http://localhost:${port}`);
		});
	})
	.catch((error) => {
		console.error("Failed to prepare users schema:", error);
		console.error(
			"Backend is running, but DB sync is disabled until DATABASE_URL is fixed in backend/.env"
		);

		app.listen(port, () => {
			console.log(`Study Buddy backend running on http://localhost:${port}`);
		});
	});
