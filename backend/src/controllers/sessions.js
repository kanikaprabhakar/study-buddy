import sql from "../supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";

export async function logSession(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { duration_min = 25, mode = "focus", studied_on } = req.body ?? {};
	const safeDate = typeof studied_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(studied_on)
		? studied_on : null;
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
}

export async function getWeekDays(req, res) {
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
}
