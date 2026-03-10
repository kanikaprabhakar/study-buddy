import sql from "../supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";

export async function listResources(req, res) {
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
}

export async function createResource(req, res) {
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
}

export async function updateResource(req, res) {
	const clerkId = await requireAuth(req, res);
	if (!clerkId) return;
	const { id } = req.params;
	const { name, url, description } = req.body ?? {};
	try {
		const [existing] = await sql`
			select * from public.resources where id = ${id} and clerk_id = ${clerkId}
		`;
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
}

export async function deleteResource(req, res) {
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
}
