import { google } from "googleapis";
import sql from "../supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getOAuth2Client } from "../lib/gcalClient.js";

export async function getAuthUrl(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
		return res.status(501).json({ error: "Google Calendar not configured on this server" });
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
}

export async function handleCallback(req, res) {
	const { code, state: clerkId, error: oauthError } = req.query;
	const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
	if (oauthError || !code || !clerkId) return res.redirect(`${frontendUrl}/dashboard?gcal=error`);
	try {
		const oauth2Client = getOAuth2Client();
		const { tokens } = await oauth2Client.getToken(String(code));
		oauth2Client.setCredentials(tokens);

		let gcalEmail = null;
		try {
			const calendar = google.calendar({ version: "v3", auth: oauth2Client });
			const { data: primaryCal } = await calendar.calendars.get({ calendarId: "primary" });
			gcalEmail = primaryCal.id ?? null;
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
}

export async function getStatus(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	try {
		const [row] = await sql`
			select id, gcal_email as "gcalEmail", refresh_token, access_token, token_expiry
			from public.calendar_connections
			where clerk_id = ${clerkId} and provider = 'google'
		`;
		if (!row) return res.json({ connected: false, gcalEmail: null });
		// Lazily backfill gcal_email for existing connections that predate the gcal_email column
		if (!row.gcalEmail && row.refresh_token) {
			try {
				const oauth2Client = getOAuth2Client();
				oauth2Client.setCredentials({
					refresh_token: row.refresh_token,
					access_token:  row.access_token,
					expiry_date:   row.token_expiry ? new Date(row.token_expiry).getTime() : undefined,
				});
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
}

export async function disconnect(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	try {
		await sql`delete from public.calendar_connections where clerk_id = ${clerkId} and provider = 'google'`;
		res.status(204).end();
	} catch (err) {
		console.error("DELETE /api/gcal/disconnect:", err);
		res.status(500).json({ error: "Database error" });
	}
}

export async function getEvents(req, res) {
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
		const now  = new Date();
		const end  = new Date(now);
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
}

export async function addEvent(req, res) {
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
}
