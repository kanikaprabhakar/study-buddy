export type Priority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  deadline?: string; // ISO date string yyyy-mm-dd or null from DB
  priority: Priority;
  done: boolean;
  createdAt: string;
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
  patch: Partial<Pick<Task, "title" | "deadline" | "priority" | "done">>,
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

/* ── internal normaliser ── */
function normaliseRow(row: Record<string, unknown>): Task {
  return {
    id:        String(row.id),
    title:     String(row.title),
    deadline:  row.deadline ? String(row.deadline).slice(0, 10) : undefined,
    priority:  (row.priority as Priority) ?? "medium",
    done:      Boolean(row.done),
    createdAt: String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
  };
}
