import { verifyToken } from "@clerk/backend";

/**
 * Verifies the Bearer token in the Authorization header.
 * Returns the Clerk user ID (sub) on success, or sends a 401 and returns null.
 */
export async function requireAuth(req, res) {
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
