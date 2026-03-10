export type Priority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  deadline?: string; // ISO date string yyyy-mm-dd or null from DB
  priority: Priority;
  done: boolean;
  createdAt: string;
  completedOn?: string; // date task was marked done (YYYY-MM-DD)
}

/* ── pure helpers (no network, no side-effects) ── */

export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const po = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (po !== 0) return po;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; darkBg: string }> = {
  high:   { label: "High",   color: "#BF3556", bg: "rgba(191,53,86,0.13)",  darkBg: "rgba(191,53,86,0.20)" },
  medium: { label: "Medium", color: "#CB438B", bg: "rgba(203,67,139,0.12)", darkBg: "rgba(203,67,139,0.18)" },
  low:    { label: "Low",    color: "#6C6A43", bg: "rgba(108,106,67,0.12)", darkBg: "rgba(108,106,67,0.18)" },
};

/* ── API helpers ── */

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

function headers(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

/** Fetch all tasks for the signed-in user */
export async function fetchTasks(token: string): Promise<Task[]> {
  const res = await fetch(`${BASE}/api/tasks`, { headers: headers(token) });
  if (!res.ok) throw new Error(`fetchTasks: ${res.status}`);
  const rows = await res.json() as Array<Record<string, unknown>>;
  // normalise DB snake_case → camelCase and null deadline → undefined
  return rows.map(normaliseRow);
}

/** Create a new task */
export async function apiCreateTask(
  token: string,
  data: Pick<Task, "title" | "priority"> & { deadline?: string },
): Promise<Task> {
  const res = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`apiCreateTask: ${res.status}`);
  return normaliseRow(await res.json() as Record<string, unknown>);
}

/** Patch an existing task (partial update) */
export async function apiPatchTask(
  token: string,
  id: string,
  patch: Partial<Pick<Task, "title" | "deadline" | "priority" | "done">> & { completed_on?: string },
): Promise<Task> {
  const res = await fetch(`${BASE}/api/tasks/${id}`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`apiPatchTask: ${res.status}`);
  return normaliseRow(await res.json() as Record<string, unknown>);
}

/** Delete a task */
export async function apiDeleteTask(token: string, id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/tasks/${id}`, {
    method: "DELETE",
    headers: headers(token),
  });
  if (!res.ok && res.status !== 204) throw new Error(`apiDeleteTask: ${res.status}`);
}

/** Log a completed focus session */
export async function apiLogSession(
  token: string,
  data: { duration_min: number; mode: string; studied_on?: string },
): Promise<void> {
  await fetch(`${BASE}/api/sessions`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(data),
  });
  // fire-and-forget — don't throw; losing a log is non-critical
}

/** Get distinct study days (ISO strings) for the current week.
 *  Pass `from` as the local-timezone Monday ISO string for timezone-correct filtering. */
export async function fetchWeekStudyDays(token: string, from?: string): Promise<string[]> {
  const url = from
    ? `${BASE}/api/sessions/week?from=${encodeURIComponent(from)}`
    : `${BASE}/api/sessions/week`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) throw new Error(`fetchWeekStudyDays: ${res.status}`);
  return res.json() as Promise<string[]>;
}

/* ── Day summary ── */

export interface DaySummaryTask {
  id: string;
  title: string;
  priority: Priority;
}

export interface DaySummarySession {
  id: string;
  durationMin: number;
  mode: string;
}

export interface DaySummary {
  tasks: DaySummaryTask[];
  sessions: DaySummarySession[];
}

export async function fetchDaySummary(token: string, date: string): Promise<DaySummary> {
  const res = await fetch(`${BASE}/api/day-summary?date=${encodeURIComponent(date)}`, { headers: headers(token) });
  if (!res.ok) return { tasks: [], sessions: [] };
  return res.json() as Promise<DaySummary>;
}

/* ── internal normaliser ── */
function normaliseRow(row: Record<string, unknown>): Task {
  return {
    id:          String(row.id),
    title:       String(row.title),
    deadline:    row.deadline    ? String(row.deadline).slice(0, 10)    : undefined,
    priority:    (row.priority as Priority) ?? "medium",
    done:        Boolean(row.done),
    createdAt:   String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
    completedOn: row.completedOn ? String(row.completedOn).slice(0, 10) : undefined,
  };
}

/* ── Resources (bookmarks) ── */

export interface Resource {
  id: string;
  name: string;
  url: string;
  description?: string;
  createdAt: string;
}

function normaliseResource(row: Record<string, unknown>): Resource {
  return {
    id:          String(row.id),
    name:        String(row.name),
    url:         String(row.url),
    description: row.description ? String(row.description) : undefined,
    createdAt:   String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
  };
}

export async function fetchResources(token: string): Promise<Resource[]> {
  const res = await fetch(`${BASE}/api/resources`, { headers: headers(token) });
  if (!res.ok) throw new Error(`fetchResources: ${res.status}`);
  const rows = await res.json() as Array<Record<string, unknown>>;
  return rows.map(normaliseResource);
}

export async function apiCreateResource(
  token: string,
  data: { name: string; url: string; description?: string },
): Promise<Resource> {
  const res = await fetch(`${BASE}/api/resources`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`apiCreateResource: ${res.status}`);
  return normaliseResource(await res.json() as Record<string, unknown>);
}

export async function apiPatchResource(
  token: string,
  id: string,
  patch: Partial<{ name: string; url: string; description: string }>,
): Promise<Resource> {
  const res = await fetch(`${BASE}/api/resources/${id}`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`apiPatchResource: ${res.status}`);
  return normaliseResource(await res.json() as Record<string, unknown>);
}

export async function apiDeleteResource(token: string, id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/resources/${id}`, {
    method: "DELETE",
    headers: headers(token),
  });
  if (!res.ok && res.status !== 204) throw new Error(`apiDeleteResource: ${res.status}`);
}

/* ── Google Calendar ── */

export interface GCalEvent {
  id: string;
  title: string;
  start: string | null;
  isAllDay: boolean;
  link: string | null;
}

export async function fetchGCalStatus(token: string): Promise<{ connected: boolean; gcalEmail?: string }> {
  const res = await fetch(`${BASE}/api/gcal/status`, { headers: headers(token) });
  if (!res.ok) return { connected: false };
  const j = await res.json() as { connected: boolean; gcalEmail?: string | null };
  return { connected: j.connected, gcalEmail: j.gcalEmail ?? undefined };
}

export async function fetchGCalAuthUrl(token: string): Promise<string | null> {
  const res = await fetch(`${BASE}/api/gcal/auth-url`, { headers: headers(token) });
  if (!res.ok) return null;
  const j = await res.json() as { url?: string };
  return j.url ?? null;
}

export async function fetchGCalEvents(token: string, days = 7): Promise<GCalEvent[]> {
  const res = await fetch(`${BASE}/api/gcal/events?days=${days}`, { headers: headers(token) });
  if (!res.ok) return [];
  return res.json() as Promise<GCalEvent[]>;
}

export async function apiGCalDisconnect(token: string): Promise<void> {
  await fetch(`${BASE}/api/gcal/disconnect`, { method: "DELETE", headers: headers(token) });
}

export async function apiGCalAddEvent(
  token: string,
  data: { title: string; deadline: string; description?: string },
): Promise<{ id: string; link: string } | null> {
  const res = await fetch(`${BASE}/api/gcal/add-event`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ id: string; link: string }>;
}
