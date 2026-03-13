import sql from "../supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";

function isoDate(d) {
	return d.toISOString().slice(0, 10);
}

function parseIsoDate(iso) {
	return new Date(`${iso}T00:00:00Z`);
}

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

export async function getCurrentStreak(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;

	try {
		const rows = await sql`
			select distinct day::text as day
			from (
				select studied_on as day
				from public.study_sessions
				where clerk_id = ${clerkId} and studied_on is not null
				union
				select completed_on as day
				from public.tasks
				where clerk_id = ${clerkId} and completed_on is not null
			) d
			order by day desc
		`;

		const activity = rows.map((r) => String(r.day).slice(0, 10));
		if (activity.length === 0) {
			return res.json({ streak: 0, lastActiveDate: null });
		}

		const todayIso = isoDate(new Date());
		const yesterday = new Date();
		yesterday.setUTCDate(yesterday.getUTCDate() - 1);
		const yesterdayIso = isoDate(yesterday);
		const latest = activity[0];

		if (latest < yesterdayIso) {
			return res.json({ streak: 0, lastActiveDate: latest });
		}

		let streak = 1;
		let cursor = parseIsoDate(latest);
		for (let i = 1; i < activity.length; i += 1) {
			cursor.setUTCDate(cursor.getUTCDate() - 1);
			const expected = isoDate(cursor);
			if (activity[i] === expected) {
				streak += 1;
			} else {
				break;
			}
		}

		res.json({
			streak,
			lastActiveDate: latest,
			activeToday: latest === todayIso,
		});
	} catch (err) {
		console.error("GET /api/sessions/streak:", err);
		res.status(500).json({ error: "Database error" });
	}
}

export async function getWeeklySummary(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;

	const now = new Date();
	const dayOfWeek = (now.getUTCDay() + 6) % 7;
	const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	monday.setUTCDate(monday.getUTCDate() - dayOfWeek);
	const weekStart = isoDate(monday);
	const sunday = new Date(monday);
	sunday.setUTCDate(sunday.getUTCDate() + 6);
	const weekEnd = isoDate(sunday);

	try {
		const [sessionAgg] = await sql`
			select coalesce(sum(duration_min), 0)::int as "focusMinutes"
			from public.study_sessions
			where clerk_id = ${clerkId}
			  and studied_on >= ${weekStart}::date
			  and studied_on < (${weekStart}::date + interval '7 days')
		`;

		const [taskAgg] = await sql`
			select count(*)::int as "tasksCompleted"
			from public.tasks
			where clerk_id = ${clerkId}
			  and completed_on >= ${weekStart}::date
			  and completed_on < (${weekStart}::date + interval '7 days')
		`;

		const [notesAgg] = await sql`
			select count(*)::int as "notesWritten"
			from public.notes
			where clerk_id = ${clerkId}
			  and created_at >= ${weekStart}::date
			  and created_at < (${weekStart}::date + interval '7 days')
		`;

		const [daysAgg] = await sql`
			select count(distinct day)::int as "activeDays"
			from (
				select studied_on as day
				from public.study_sessions
				where clerk_id = ${clerkId}
				  and studied_on >= ${weekStart}::date
				  and studied_on < (${weekStart}::date + interval '7 days')
				union
				select completed_on as day
				from public.tasks
				where clerk_id = ${clerkId}
				  and completed_on >= ${weekStart}::date
				  and completed_on < (${weekStart}::date + interval '7 days')
			) d
		`;

		res.json({
			weekStart,
			weekEnd,
			focusMinutes: Number(sessionAgg?.focusMinutes ?? 0),
			tasksCompleted: Number(taskAgg?.tasksCompleted ?? 0),
			notesWritten: Number(notesAgg?.notesWritten ?? 0),
			activeDays: Number(daysAgg?.activeDays ?? 0),
		});
	} catch (err) {
		console.error("GET /api/sessions/weekly-summary:", err);
		res.status(500).json({ error: "Database error" });
	}
}
