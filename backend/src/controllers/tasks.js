import sql from "../supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";
import OpenAI from "openai";

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

/**
 * POST /api/tasks/generate-plan
 * Body: { intensity: "light"|"moderate"|"intense", subject: string, weekStart: "YYYY-MM-DD" }
 * Uses Gemini to generate a Mon-Fri task schedule and bulk-inserts into tasks.
 * Returns the created tasks array.
 */
export async function generateWeeklyPlan(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;

	const { intensity = "moderate", subject = "Study", weekStart } = req.body ?? {};

	if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(String(weekStart)))
		return res.status(400).json({ error: "weekStart required (YYYY-MM-DD)" });

	if (!subject?.trim())
		return res.status(400).json({ error: "subject is required" });

	if (!process.env.GITHUB_TOKEN)
		return res.status(503).json({ error: "AI plan generation is not configured" });

	// Build Mon-Fri date strings
	const monday = new Date(weekStart + "T00:00:00");
	const dates = Array.from({ length: 5 }, (_, i) => {
		const d = new Date(monday);
		d.setDate(monday.getDate() + i);
		return d.toISOString().slice(0, 10);
	});

	const prompt = `You are a study planner assistant.
Generate exactly 5 study tasks for Mon-Fri for a student studying "${subject.trim()}" at ${intensity} intensity.

Day pattern:
- Day 0 (Mon): learn new material
- Day 1 (Tue): continue learning / go deeper
- Day 2 (Wed): practice / apply / solve problems
- Day 3 (Thu): revise and fix mistakes
- Day 4 (Fri): full-week review and consolidation

Intensity guide:
- light: gentle, low-medium priority tasks, short sessions
- moderate: focused, medium-high priority, solid problem sets
- intense: rigorous, all high priority, timed challenges and deep review

Return ONLY a valid JSON array with exactly 5 objects. No markdown, no extra text.
Each object must have exactly these fields:
{ "day": <0-4>, "title": "<concise actionable task, max 90 chars>", "priority": "<low|medium|high>" }

Make titles specific to "${subject.trim()}", not generic.`;

	const FALLBACK_TEMPLATES = {
		light: [
			{ day: 0, priority: "low",    title: (s) => `Introduction to ${s} — read overview notes` },
			{ day: 1, priority: "low",    title: (s) => `${s} — review key concepts and definitions` },
			{ day: 2, priority: "medium", title: (s) => `${s} — light practice exercises` },
			{ day: 3, priority: "low",    title: (s) => `${s} — revise today's mistakes` },
			{ day: 4, priority: "medium", title: (s) => `${s} — end-of-week recap` },
		],
		moderate: [
			{ day: 0, priority: "medium", title: (s) => `${s} — study new chapter and take notes` },
			{ day: 1, priority: "medium", title: (s) => `${s} — go deeper: worked examples` },
			{ day: 2, priority: "high",   title: (s) => `${s} — problem set (timed 45 min)` },
			{ day: 3, priority: "medium", title: (s) => `${s} — revise errors, re-do weak areas` },
			{ day: 4, priority: "high",   title: (s) => `${s} — full week review quiz` },
		],
		intense: [
			{ day: 0, priority: "high",   title: (s) => `${s} — deep-dive new material (2 h)` },
			{ day: 1, priority: "high",   title: (s) => `${s} — advanced examples + edge cases` },
			{ day: 2, priority: "high",   title: (s) => `${s} — timed challenge (hard problems)` },
			{ day: 3, priority: "high",   title: (s) => `${s} — full error analysis + re-practice` },
			{ day: 4, priority: "high",   title: (s) => `${s} — comprehensive review + mock test` },
		],
	};

	let plan;
	let usedFallback = false;
	try {
		const client = new OpenAI({
			baseURL: "https://models.inference.ai.azure.com",
			apiKey: process.env.GITHUB_TOKEN,
		});
		const response = await client.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [{ role: "user", content: prompt }],
			temperature: 0.7,
		});
		const text = response.choices[0]?.message?.content?.trim() ?? "";

		// Strip markdown code fences if model wraps response anyway
		const json = text.replace(/^```[\w]*\n?/m, "").replace(/```$/m, "").trim();
		plan = JSON.parse(json);

		if (!Array.isArray(plan) || plan.length !== 5)
			throw new Error("Unexpected shape from model");
	} catch (err) {
		// 429 = quota exhausted — silently fall back to templates
		if (err?.status === 429) {
			console.warn("GitHub Models quota exhausted, falling back to templates.");
			const template = FALLBACK_TEMPLATES[intensity] ?? FALLBACK_TEMPLATES.moderate;
			const sub = subject.trim();
			plan = template.map((t) => ({ day: t.day, title: t.title(sub), priority: t.priority }));
			usedFallback = true;
		} else {
			console.error("GitHub Models generate-plan error:", err);
			return res.status(502).json({ error: "AI generation failed. Please try again." });
		}
	}

	// Map day index → deadline — return preview only, NO DB write yet
	const preview = plan.map((t) => ({
		day:      t.day,
		title:    String(t.title).slice(0, 90),
		priority: ["low","medium","high"].includes(t.priority) ? t.priority : "medium",
		deadline: dates[t.day] ?? dates[0],
	}));

	res.json(usedFallback ? { tasks: preview, fallback: true } : { tasks: preview });
}

/**
 * POST /api/tasks/confirm-plan
 * Body: { tasks: [{title, deadline, priority}] }
 * Called when user clicks "Add to my tasks" in the modal — does the actual DB insert.
 */
export async function confirmWeeklyPlan(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;

	const { tasks } = req.body ?? {};
	if (!Array.isArray(tasks) || tasks.length === 0)
		return res.status(400).json({ error: "tasks array is required" });

	const titles     = tasks.map((t) => String(t.title ?? "").slice(0, 90));
	const deadlines  = tasks.map((t) => (t.deadline && /^\d{4}-\d{2}-\d{2}$/.test(String(t.deadline)) ? String(t.deadline) : null));
	const priorities = tasks.map((t) => (["low","medium","high"].includes(t.priority) ? t.priority : "medium"));

	if (titles.some((t) => !t.trim()))
		return res.status(400).json({ error: "All tasks must have a title" });

	try {
		const rows = await sql`
			insert into public.tasks (clerk_id, title, deadline, priority)
			select * from unnest(
				${sql.array(tasks.map(() => clerkId))}::text[],
				${sql.array(titles)}::text[],
				${sql.array(deadlines)}::date[],
				${sql.array(priorities)}::text[]
			) as t(clerk_id, title, deadline, priority)
			returning id, title, deadline, priority, done, completed_on as "completedOn", created_at as "createdAt"
		`;
		res.status(201).json(rows);
	} catch (err) {
		console.error("POST /api/tasks/confirm-plan DB error:", err);
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
