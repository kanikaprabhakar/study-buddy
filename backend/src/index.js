import "dotenv/config";
import dns from "node:dns";
import cors from "cors";
import express from "express";

import { ensureUsersSchema, ensureTasksSchema, ensureSessionsSchema, ensureResourcesSchema, ensureCalendarSchema, ensureNotesSchema } from "./db/schema.js";
import { getDaySummary } from "./controllers/tasks.js";
import { internalSyncUser } from "./controllers/webhooks.js";
import taskRoutes     from "./routes/tasks.js";
import sessionRoutes  from "./routes/sessions.js";
import resourceRoutes from "./routes/resources.js";
import gcalRoutes     from "./routes/gcal.js";
import webhookRoutes  from "./routes/webhooks.js";
import noteRoutes     from "./routes/notes.js";

dns.setDefaultResultOrder("ipv4first");

const app  = express();
const port = Number(process.env.PORT || 4000);

/* â”€â”€ Global middleware â”€â”€ */
app.use(cors());
app.use(express.json());

/* â”€â”€ Health â”€â”€ */
app.get("/health", (_req, res) => res.status(200).json({ ok: true, service: "zenith-backend" }));

/* â”€â”€ API routes â”€â”€ */
app.use("/api/tasks",     taskRoutes);
app.use("/api/sessions",  sessionRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/gcal",      gcalRoutes);
app.use("/api/webhooks",  webhookRoutes);
app.use("/api/notes",     noteRoutes);
app.post("/api/internal/sync-user", express.json(), internalSyncUser);

// Kept at original URL â€” frontend calls GET /api/day-summary
app.get("/api/day-summary", getDaySummary);

/* â”€â”€ Bootstrap DB schema then start server â”€â”€ */
Promise.all([
	ensureUsersSchema(),
	ensureTasksSchema(),
	ensureSessionsSchema(),
	ensureResourcesSchema(),
	ensureCalendarSchema(),
	ensureNotesSchema(),
]).then(() => {
	app.listen(port, () => console.log(`Zenith backend running on http://localhost:${port}`));
}).catch((err) => {
	console.error("Failed to prepare schema:", err);
	console.error("Backend is running, but DB sync is disabled until DATABASE_URL is fixed in backend/.env");
	app.listen(port, () => console.log(`Zenith backend running on http://localhost:${port}`));
});

