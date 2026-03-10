import sql from "../supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";

export async function listNotes(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	try {
		const rows = await sql`
			select id, heading, description, content, created_at as "createdAt", updated_at as "updatedAt"
			from public.notes
			where clerk_id = ${clerkId}
			order by updated_at desc
		`;
		res.json(rows);
	} catch (err) {
		console.error("GET /api/notes:", err);
		res.status(500).json({ error: "Database error" });
	}
}

export async function getNote(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { id } = req.params;
	try {
		const [row] = await sql`
			select id, heading, description, content, created_at as "createdAt", updated_at as "updatedAt"
			from public.notes
			where id = ${id} and clerk_id = ${clerkId}
		`;
		if (!row) return res.status(404).json({ error: "Note not found" });
		res.json(row);
	} catch (err) {
		console.error("GET /api/notes/:id:", err);
		res.status(500).json({ error: "Database error" });
	}
}

export async function createNote(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { heading = "Untitled", description, content = "" } = req.body ?? {};
	try {
		const [row] = await sql`
			insert into public.notes (clerk_id, heading, description, content)
			values (${clerkId}, ${String(heading).trim() || "Untitled"}, ${description ?? null}, ${content})
			returning id, heading, description, content, created_at as "createdAt", updated_at as "updatedAt"
		`;
		res.status(201).json(row);
	} catch (err) {
		console.error("POST /api/notes:", err);
		res.status(500).json({ error: "Database error" });
	}
}

export async function updateNote(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { id } = req.params;
	const { heading, description, content } = req.body ?? {};
	try {
		const [existing] = await sql`
			select * from public.notes where id = ${id} and clerk_id = ${clerkId}
		`;
		if (!existing) return res.status(404).json({ error: "Note not found" });
		const safeHeading = heading !== undefined ? (String(heading).trim() || "Untitled") : existing.heading;
		const safeDesc    = description !== undefined ? (description || null) : existing.description;
		const safeContent = content    !== undefined ? content                : existing.content;
		const [row] = await sql`
			update public.notes
			set heading = ${safeHeading}, description = ${safeDesc}, content = ${safeContent}, updated_at = now()
			where id = ${id} and clerk_id = ${clerkId}
			returning id, heading, description, content, created_at as "createdAt", updated_at as "updatedAt"
		`;
		res.json(row);
	} catch (err) {
		console.error("PATCH /api/notes/:id:", err);
		res.status(500).json({ error: "Database error" });
	}
}

export async function deleteNote(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { id } = req.params;
	try {
		await sql`delete from public.notes where id = ${id} and clerk_id = ${clerkId}`;
		res.status(204).end();
	} catch (err) {
		console.error("DELETE /api/notes/:id:", err);
		res.status(500).json({ error: "Database error" });
	}
}
