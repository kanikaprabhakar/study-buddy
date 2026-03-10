import "dotenv/config";
import dns from "node:dns";
import cors from "cors";
import express from "express";
import { Webhook } from "svix";
import { verifyToken } from "@clerk/backend";
import { google } from "googleapis";
import sql from "./supabase.js";

function getOAuth2Client() {
	return new google.auth.OAuth2(
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_CLIENT_SECRET,
		process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:4000/api/gcal/callback",
	);
}

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
	const displayName = fullName || user.username || "Zenith User";

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
	await sql`alter table public.tasks add column if not exists completed_on date`;
}

app.use(cors());

app.get("/health", (_req, res) => {
	res.status(200).json({ ok: true, service: "zenith-backend" });
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
			select id, title, deadline, priority, done, completed_on as "completedOn", created_at as "createdAt"
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
			returning id, title, deadline, priority, done, completed_on as "completedOn", created_at as "createdAt"
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
		// completed_on: set when newly marking done, clear when un-doing, preserve otherwise
		let completedOn = existing.completed_on ?? null;
		if (body.done !== undefined) {
			if (Boolean(body.done) && !existing.done) {
				const safe = typeof body.completed_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.completed_on)
					? body.completed_on : null;
				completedOn = safe;
			} else if (!Boolean(body.done)) {
				completedOn = null;
			}
		}

		const [row] = await sql`
			update public.tasks
			set title = ${title}, deadline = ${deadline}, priority = ${priority}, done = ${done}, completed_on = ${completedOn}
			where id = ${id} and clerk_id = ${clerkId}
			returning id, title, deadline, priority, done, completed_on as "completedOn", created_at as "createdAt"
		`;
		res.json(row);
	} catch (err) {
		console.error("PATCH /api/tasks:", err);
		res.status(500).json({ error: "Database error" });
	}
});

// GET /api/day-summary?date=YYYY-MM-DD — tasks completed + sessions studied on a given day
app.get("/api/day-summary", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const rawDate = req.query.date;
	if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(rawDate)))
		return res.status(400).json({ error: "date required (YYYY-MM-DD)" });
	const d = String(rawDate);
	try {
		const tasks = await sql`
			select id, title, priority
			from public.tasks
			where clerk_id = ${clerkId} and completed_on = ${d}::date
			order by created_at asc
		`;
		const sessions = await sql`
			select id, duration_min as "durationMin", mode
			from public.study_sessions
			where clerk_id = ${clerkId} and studied_on = ${d}::date
			order by created_at asc
		`;
		res.json({ tasks, sessions });
	} catch (err) {
		console.error("GET /api/day-summary:", err);
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

/* ── Study sessions ── */

// POST /api/sessions — log a completed focus session
app.post("/api/sessions", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { duration_min = 25, mode = "focus", studied_on } = req.body ?? {};
	// studied_on is the client's local date (YYYY-MM-DD); validate before using
	const safeDate = typeof studied_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(studied_on)
		? studied_on
		: null;
	try {
		const [row] = safeDate
			? await sql`
				insert into public.study_sessions (clerk_id, duration_min, mode, studied_on)
				values (${clerkId}, ${Number(duration_min)}, ${String(mode)}, ${safeDate}::date)
				returning id, duration_min as "durationMin", mode, studied_on as "studiedOn", created_at as "createdAt"
			`
			: await sql`
				insert into public.study_sessions (clerk_id, duration_min, mode)
				values (${clerkId}, ${Number(duration_min)}, ${String(mode)})
				returning id, duration_min as "durationMin", mode, studied_on as "studiedOn", created_at as "createdAt"
			`;
		res.status(201).json(row);
	} catch (err) {
		console.error("POST /api/sessions:", err);
		res.status(500).json({ error: "Database error" });
	}
});

// GET /api/sessions/week — return distinct study days for the current week
// Accepts optional ?from=YYYY-MM-DD (client's local Monday) for timezone-correct results
app.get("/api/sessions/week", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const rawFrom = req.query.from;
	const from = typeof rawFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? rawFrom : null;
	try {
		const rows = from
			? await sql`
				select distinct studied_on::text as "studiedOn"
				from public.study_sessions
				where clerk_id = ${clerkId}
				  and studied_on >= ${from}::date
				  and studied_on <  (${from}::date + interval '7 days')
			`
			: await sql`
				select distinct studied_on::text as "studiedOn"
				from public.study_sessions
				where clerk_id = ${clerkId}
				  and studied_on >= date_trunc('week', current_date)
				  and studied_on <  date_trunc('week', current_date) + interval '7 days'
			`;
		res.json(rows.map((r) => r.studiedOn));
	} catch (err) {
		console.error("GET /api/sessions/week:", err);
		res.status(500).json({ error: "Database error" });
	}
});

/* ── Sessions schema ── */
async function ensureSessionsSchema() {
	await sql`
		create table if not exists public.study_sessions (
			id           uuid primary key default gen_random_uuid(),
			clerk_id     text not null,
			duration_min integer not null default 25,
			mode         text not null default 'focus',
			studied_on   date not null default current_date,
			created_at   timestamptz not null default now()
		)
	`;
	await sql`
		create index if not exists study_sessions_clerk_id_idx on public.study_sessions (clerk_id)
	`;
	await sql`
		create index if not exists study_sessions_studied_on_idx on public.study_sessions (clerk_id, studied_on)
	`;
}

/* ── Resources schema ── */
async function ensureResourcesSchema() {
	await sql`
		create table if not exists public.resources (
			id          uuid primary key default gen_random_uuid(),
			clerk_id    text not null,
			name        text not null,
			url         text not null,
			description text,
			created_at  timestamptz not null default now()
		)
	`;
	await sql`create index if not exists resources_clerk_id_idx on public.resources (clerk_id)`;
}

/* ── Calendar connections schema ── */
async function ensureCalendarSchema() {
	await sql`alter table public.calendar_connections add column if not exists clerk_id text`;
	await sql`alter table public.calendar_connections add column if not exists access_token text`;
	await sql`alter table public.calendar_connections add column if not exists token_expiry timestamptz`;
	await sql`alter table public.calendar_connections add column if not exists gcal_email text`;
	try {
		await sql`
			create unique index if not exists cal_conn_clerk_provider_key
			on public.calendar_connections (clerk_id, provider)
			where clerk_id is not null
		`;
	} catch { /* index already exists */ }
}

/* ── Resources CRUD ── */

// GET /api/resources
app.get("/api/resources", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	try {
		const rows = await sql`
			select id, name, url, description, created_at as "createdAt"
			from public.resources
			where clerk_id = ${clerkId}
			order by created_at desc
		`;
		res.json(rows);
	} catch (err) {
		console.error("GET /api/resources:", err);
		res.status(500).json({ error: "Database error" });
	}
});

// POST /api/resources
app.post("/api/resources", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { name, url, description } = req.body ?? {};
	if (!name?.trim() || !url?.trim()) return res.status(400).json({ error: "name and url are required" });
	try { new URL(url.trim()); } catch { return res.status(400).json({ error: "Invalid URL" }); }
	try {
		const [row] = await sql`
			insert into public.resources (clerk_id, name, url, description)
			values (${clerkId}, ${name.trim()}, ${url.trim()}, ${description ?? null})
			returning id, name, url, description, created_at as "createdAt"
		`;
		res.status(201).json(row);
	} catch (err) {
		console.error("POST /api/resources:", err);
		res.status(500).json({ error: "Database error" });
	}
});

// PATCH /api/resources/:id
app.patch("/api/resources/:id", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { id } = req.params;
	const { name, url, description } = req.body ?? {};
	try {
		const [existing] = await sql`select * from public.resources where id = ${id} and clerk_id = ${clerkId}`;
		if (!existing) return res.status(404).json({ error: "Resource not found" });
		const safeName = name?.trim()  ?? existing.name;
		const safeUrl  = url?.trim()   ?? existing.url;
		const safeDesc = description !== undefined ? (description || null) : existing.description;
		if (url?.trim()) { try { new URL(safeUrl); } catch { return res.status(400).json({ error: "Invalid URL" }); } }
		const [row] = await sql`
			update public.resources
			set name = ${safeName}, url = ${safeUrl}, description = ${safeDesc}
			where id = ${id} and clerk_id = ${clerkId}
			returning id, name, url, description, created_at as "createdAt"
		`;
		res.json(row);
	} catch (err) {
		console.error("PATCH /api/resources:", err);
		res.status(500).json({ error: "Database error" });
	}
});

// DELETE /api/resources/:id
app.delete("/api/resources/:id", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { id } = req.params;
	try {
		await sql`delete from public.resources where id = ${id} and clerk_id = ${clerkId}`;
		res.status(204).end();
	} catch (err) {
		console.error("DELETE /api/resources:", err);
		res.status(500).json({ error: "Database error" });
	}
});

/* ── Google Calendar OAuth ── */

// GET /api/gcal/auth-url
app.get("/api/gcal/auth-url", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
		return res.status(501).json({ error: "Google Calendar not configured on this server" });
	}
	const oauth2Client = getOAuth2Client();
	const url = oauth2Client.generateAuthUrl({
		access_type: "offline",
		scope: [
			"https://www.googleapis.com/auth/calendar.readonly",
			"https://www.googleapis.com/auth/calendar.events",
			"openid",
			"email",
			"profile",
		],
		state: clerkId,
		prompt: "consent",
	});
	res.json({ url });
});

// GET /api/gcal/callback — browser redirect from Google
app.get("/api/gcal/callback", async (req, res) => {
	const { code, state: clerkId, error: oauthError } = req.query;
	const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
	if (oauthError || !code || !clerkId) return res.redirect(`${frontendUrl}/dashboard?gcal=error`);
	try {
		const oauth2Client = getOAuth2Client();
		const { tokens } = await oauth2Client.getToken(String(code));
		oauth2Client.setCredentials(tokens);
		// Get user's email from their primary calendar ID (works with calendar scopes already granted)
		let gcalEmail = null;
		try {
			const calendar = google.calendar({ version: "v3", auth: oauth2Client });
			const { data: primaryCal } = await calendar.calendars.get({ calendarId: "primary" });
			gcalEmail = primaryCal.id ?? null; // primary calendar id === user's google email
		} catch { /* non-critical */ }
		await sql`
			insert into public.calendar_connections
				(clerk_id, provider, refresh_token, access_token, token_expiry, gcal_email)
			values (
				${String(clerkId)}, 'google',
				${tokens.refresh_token ?? null},
				${tokens.access_token  ?? null},
				${tokens.expiry_date   ? new Date(tokens.expiry_date) : null},
				${gcalEmail}
			)
			on conflict (clerk_id, provider) where clerk_id is not null
			do update set
				refresh_token = coalesce(excluded.refresh_token, calendar_connections.refresh_token),
				access_token  = excluded.access_token,
				token_expiry  = excluded.token_expiry,
				gcal_email    = coalesce(excluded.gcal_email, calendar_connections.gcal_email),
				connected_at  = now()
		`;
		return res.redirect(`${frontendUrl}/dashboard?gcal=connected`);
	} catch (err) {
		console.error("Google OAuth callback error:", err);
		return res.redirect(`${frontendUrl}/dashboard?gcal=error`);
	}
});

// GET /api/gcal/status
app.get("/api/gcal/status", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	try {
		const [row] = await sql`
			select id, gcal_email as "gcalEmail", refresh_token, access_token, token_expiry
			from public.calendar_connections
			where clerk_id = ${clerkId} and provider = 'google'
		`;
		if (!row) return res.json({ connected: false, gcalEmail: null });
		// Lazily backfill gcal_email for existing connections (one-time per user)
		if (!row.gcalEmail && row.refresh_token) {
			try {
				const oauth2Client = getOAuth2Client();
				oauth2Client.setCredentials({
					refresh_token: row.refresh_token,
					access_token:  row.access_token,
					expiry_date:   row.token_expiry ? new Date(row.token_expiry).getTime() : undefined,
				});
				// Use primary calendar ID — equals user's Google email, works with existing calendar scopes
				const calendar = google.calendar({ version: "v3", auth: oauth2Client });
				const { data: primaryCal } = await calendar.calendars.get({ calendarId: "primary" });
				if (primaryCal.id) {
					row.gcalEmail = primaryCal.id;
					await sql`
						update public.calendar_connections
						set gcal_email = ${primaryCal.id}
						where clerk_id = ${clerkId} and provider = 'google'
					`.catch(console.error);
				}
			} catch { /* non-critical */ }
		}
		res.json({ connected: true, gcalEmail: row.gcalEmail ?? null });
	} catch (err) {
		console.error("GET /api/gcal/status:", err);
		res.status(500).json({ error: "Database error" });
	}
});

// DELETE /api/gcal/disconnect
app.delete("/api/gcal/disconnect", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	try {
		await sql`delete from public.calendar_connections where clerk_id = ${clerkId} and provider = 'google'`;
		res.status(204).end();
	} catch (err) {
		console.error("DELETE /api/gcal/disconnect:", err);
		res.status(500).json({ error: "Database error" });
	}
});

// GET /api/gcal/events?days=7
app.get("/api/gcal/events", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	try {
		const [conn] = await sql`
			select refresh_token, access_token, token_expiry
			from public.calendar_connections
			where clerk_id = ${clerkId} and provider = 'google'
		`;
		if (!conn?.refresh_token) return res.json([]);
		const oauth2Client = getOAuth2Client();
		oauth2Client.setCredentials({
			refresh_token: conn.refresh_token,
			access_token:  conn.access_token,
			expiry_date:   conn.token_expiry ? new Date(conn.token_expiry).getTime() : undefined,
		});
		oauth2Client.on("tokens", async (tokens) => {
			if (tokens.access_token) {
				await sql`
					update public.calendar_connections
					set access_token = ${tokens.access_token},
					    token_expiry = ${tokens.expiry_date ? new Date(tokens.expiry_date) : null}
					where clerk_id = ${clerkId} and provider = 'google'
				`.catch(console.error);
			}
		});
		const calendar = google.calendar({ version: "v3", auth: oauth2Client });
		const days = Math.min(Number(req.query.days) || 7, 30);
		const now = new Date();
		const end = new Date(now);
		end.setDate(end.getDate() + days);
		const { data } = await calendar.events.list({
			calendarId: "primary",
			timeMin: now.toISOString(),
			timeMax: end.toISOString(),
			maxResults: 10,
			singleEvents: true,
			orderBy: "startTime",
		});
		const events = (data.items ?? []).map((e) => ({
			id: e.id,
			title: e.summary ?? "(No title)",
			start: e.start?.dateTime ?? e.start?.date ?? null,
			isAllDay: !e.start?.dateTime,
			link: e.htmlLink,
		}));
		res.json(events);
	} catch (err) {
		console.error("GET /api/gcal/events:", err);
		res.status(500).json({ error: "Calendar fetch failed" });
	}
});

// POST /api/gcal/add-event
app.post("/api/gcal/add-event", async (req, res) => {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { title, deadline, description } = req.body ?? {};
	if (!title?.trim() || !deadline) return res.status(400).json({ error: "title and deadline are required" });
	if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return res.status(400).json({ error: "deadline must be YYYY-MM-DD" });
	try {
		const [conn] = await sql`
			select refresh_token, access_token, token_expiry
			from public.calendar_connections
			where clerk_id = ${clerkId} and provider = 'google'
		`;
		if (!conn?.refresh_token) return res.status(404).json({ error: "Google Calendar not connected" });
		const oauth2Client = getOAuth2Client();
		oauth2Client.setCredentials({
			refresh_token: conn.refresh_token,
			access_token:  conn.access_token,
			expiry_date:   conn.token_expiry ? new Date(conn.token_expiry).getTime() : undefined,
		});
		oauth2Client.on("tokens", async (tokens) => {
			if (tokens.access_token) {
				await sql`
					update public.calendar_connections
					set access_token = ${tokens.access_token},
					    token_expiry = ${tokens.expiry_date ? new Date(tokens.expiry_date) : null}
					where clerk_id = ${clerkId} and provider = 'google'
				`.catch(console.error);
			}
		});
		const calendar = google.calendar({ version: "v3", auth: oauth2Client });
		const event = await calendar.events.insert({
			calendarId: "primary",
			requestBody: {
				summary: title.trim(),
				description: description?.trim() || "Task added from Zenith",
				start: { date: deadline },
				end:   { date: deadline },
			},
		});
		res.json({ id: event.data.id, link: event.data.htmlLink });
	} catch (err) {
		console.error("POST /api/gcal/add-event:", err);
		res.status(500).json({ error: "Calendar error" });
	}
});

Promise.all([ensureUsersSchema(), ensureTasksSchema(), ensureSessionsSchema(), ensureResourcesSchema(), ensureCalendarSchema()])
	.then(() => {
		app.listen(port, () => {
			console.log(`Zenith backend running on http://localhost:${port}`);
		});
	})
	.catch((error) => {
		console.error("Failed to prepare schema:", error);
		console.error(
			"Backend is running, but DB sync is disabled until DATABASE_URL is fixed in backend/.env"
		);

		app.listen(port, () => {
			console.log(`Zenith backend running on http://localhost:${port}`);
		});
	});
