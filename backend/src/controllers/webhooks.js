import { Webhook } from "svix";
import sql from "../supabase.js";
import { upsertClerkUser } from "../db/schema.js";

const webhookSecret      = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
const internalSyncSecret = process.env.BACKEND_INTERNAL_SYNC_SECRET;

export async function clerkWebhook(req, res) {
	if (!webhookSecret)
		return res.status(500).json({ error: "Missing CLERK_WEBHOOK_SIGNING_SECRET in backend .env" });

	const { "svix-id": svixId, "svix-timestamp": svixTimestamp, "svix-signature": svixSignature } = req.headers;
	if (!svixId || !svixTimestamp || !svixSignature)
		return res.status(400).json({ error: "Missing Svix headers" });

	let event;
	try {
		const wh = new Webhook(webhookSecret);
		event = wh.verify(req.body.toString(), {
			"svix-id": String(svixId),
			"svix-timestamp": String(svixTimestamp),
			"svix-signature": String(svixSignature),
		});
	} catch (err) {
		console.error("Invalid Clerk webhook signature:", err);
		return res.status(400).json({ error: "Invalid webhook signature" });
	}

	try {
		if (event.type === "user.created" || event.type === "user.updated") {
			await upsertClerkUser(event.data);
		}
		if (event.type === "user.deleted" && event.data?.id) {
			await sql`delete from public.users where clerk_id = ${event.data.id}`;
		}
		return res.status(200).json({ ok: true });
	} catch (err) {
		console.error("Failed syncing Clerk user to DB:", err);
		return res.status(500).json({ error: "Database sync failed" });
	}
}

export async function internalSyncUser(req, res) {
	if (!internalSyncSecret)
		return res.status(500).json({ error: "Missing BACKEND_INTERNAL_SYNC_SECRET" });
	if (req.headers["x-sync-secret"] !== internalSyncSecret)
		return res.status(401).json({ error: "Unauthorized" });
	const user = req.body?.user;
	if (!user?.id) return res.status(400).json({ error: "Missing user payload" });
	try {
		await upsertClerkUser(user);
		return res.status(200).json({ ok: true });
	} catch (err) {
		console.error("Internal sync failed:", err);
		return res.status(500).json({ error: "Database sync failed" });
	}
}
