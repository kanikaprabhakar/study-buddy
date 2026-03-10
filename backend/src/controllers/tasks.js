import sql from "../supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";

export async function listTasks(req, res) {
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
}

export async function createTask(req, res) {
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
}

export async function updateTask(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { id } = req.params;
	const body = req.body ?? {};
	try {
		const [existing] = await sql`
			select * from public.tasks where id = ${id} and clerk_id = ${clerkId}
		`;
		if (!existing) return res.status(404).json({ error: "Task not found" });

		const title    = body.title    !== undefined ? body.title.trim()      : existing.title;
		const deadline = body.deadline !== undefined ? (body.deadline || null) : existing.deadline;
		const priority = body.priority !== undefined ? body.priority           : existing.priority;
		const done     = body.done     !== undefined ? Boolean(body.done)      : existing.done;

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
			set title = ${title}, deadline = ${deadline}, priority = ${priority},
			    done = ${done}, completed_on = ${completedOn}
			where id = ${id} and clerk_id = ${clerkId}
			returning id, title, deadline, priority, done, completed_on as "completedOn", created_at as "createdAt"
		`;
		res.json(row);
	} catch (err) {
		console.error("PATCH /api/tasks:", err);
		res.status(500).json({ error: "Database error" });
	}
}

export async function deleteTask(req, res) {
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
}

export async function getDaySummary(req, res) {
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
}
