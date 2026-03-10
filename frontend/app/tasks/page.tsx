"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { useTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  type Task,
  type Priority,
  fetchTasks,
  apiCreateTask,
  apiPatchTask,
  apiDeleteTask,
  sortTasks,
  PRIORITY_META,
  fetchGCalStatus,
  apiGCalAddEvent,
} from "@/lib/tasks";

const FLOATERS = [
  { src: "/images/14.png", w: 100, top: "3%",    left: "0%",   anim: "animate-float-slow",   delay: "0s" },
  { src: "/images/18.png", w: 90,  top: "15%",   right: "0%",  anim: "animate-float-medium", delay: "1.4s" },
  { src: "/images/12.png", w: 80,  top: "45%",   left: "0%",   anim: "animate-float-fast",   delay: "0.8s" },
  { src: "/images/21.png", w: 95,  top: "60%",   right: "0%",  anim: "animate-float-slow",   delay: "2.0s" },
  { src: "/images/10.png", w: 75,  bottom: "15%",left: "1%",   anim: "animate-float-medium", delay: "1.1s" },
  { src: "/images/24.png", w: 88,  bottom: "4%", right: "1%",  anim: "animate-float-fast",   delay: "0.5s" },
] as const;

const PRIORITIES: Priority[] = ["high", "medium", "low"];

const EMPTY_FORM = { title: "", deadline: "", priority: "medium" as Priority };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TasksPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const { getToken } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [gcalConnected, setGcalConnected] = useState(false);
  const [addedToCalIds, setAddedToCalIds] = useState<Set<string>>(new Set());
  const [toast, setToast]         = useState<string | null>(null);

  // Load tasks from API on mount
  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!token || cancelled) return;
      fetchTasks(token)
        .then((t) => { if (!cancelled) setTasks(t); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
      fetchGCalStatus(token).then(({ connected }) => { if (!cancelled) setGcalConnected(connected); }).catch(() => {});
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const token = await getToken();
    if (!token) return;
    try {
      if (editId) {
        const updated = await apiPatchTask(token, editId, {
          title: form.title,
          deadline: form.deadline || undefined,
          priority: form.priority,
        });
        setTasks((prev) => prev.map((t) => t.id === editId ? updated : t));
        setEditId(null);
      } else {
        const created = await apiCreateTask(token, {
          title: form.title,
          deadline: form.deadline || undefined,
          priority: form.priority,
        });
        setTasks((prev) => [created, ...prev]);
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      console.error("Task mutation failed:", err);
    }
  }, [form, editId, getToken]);

  const handleToggle = useCallback(async (task: Task) => {
    // optimistic
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: !t.done } : t));
    try {
      const token = await getToken();
      if (!token) throw new Error("no token");
      const updated = await apiPatchTask(token, task.id, {
        done: !task.done,
        ...(!task.done ? { completed_on: todayISO() } : {}),
      });
      setTasks((prev) => prev.map((t) => t.id === task.id ? updated : t));
    } catch {
      // revert
      setTasks((prev) => prev.map((t) => t.id === task.id ? task : t));
    }
  }, [getToken]);

  const handleDelete = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      const token = await getToken();
      if (!token) throw new Error("no token");
      await apiDeleteTask(token, id);
    } catch (err) {
      console.error("Delete failed:", err);
      // On fail, refresh
      const token = await getToken();
      if (token) fetchTasks(token).then(setTasks).catch(() => {});
    }
  }, [getToken]);

  function startEdit(t: Task) {
    setForm({ title: t.title, deadline: t.deadline ?? "", priority: t.priority });
    setEditId(t.id);
    setShowForm(true);
  }

  function cancelForm() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
  }

  const sorted = sortTasks(tasks);
  const visible = sorted.filter((t) =>
    filter === "all" ? true : filter === "done" ? t.done : !t.done
  );
  const cardBg  = dark ? "rgba(28,11,16,0.80)"  : "rgba(255,240,210,0.80)";
  const cardBdr = dark ? "rgba(203,67,139,0.28)" : "rgba(203,67,139,0.20)";
  const inputBg = dark ? "#2A0E15" : "#fff";
  const inputBdr = dark ? "rgba(203,67,139,0.30)" : "rgba(203,67,139,0.25)";

  return (
    <main className="relative min-h-screen overflow-x-hidden animate-gradient-bg">

      {/* Blobs */}
      <div aria-hidden className="pointer-events-none fixed top-[-80px] left-[-80px]  h-[340px] w-[340px] rounded-full blur-3xl opacity-25 animate-float-slow"   style={{ background: "#CB438B" }} />
      <div aria-hidden className="pointer-events-none fixed top-[35%] right-[-100px] h-[300px] w-[300px] rounded-full blur-3xl opacity-18 animate-float-medium" style={{ background: "#BF3556" }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[10%] left-[4%]  h-[240px] w-[240px] rounded-full blur-3xl opacity-14 animate-float-fast"    style={{ background: "#6C6A43" }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[-60px] right-[8%] h-[310px] w-[310px] rounded-full blur-3xl opacity-20 animate-float-slow"  style={{ background: "#4D3449" }} />

      {FLOATERS.map((f, i) => (
        <span key={i} aria-hidden className={`pointer-events-none fixed ${f.anim}`}
          style={{ top: (f as any).top, bottom: (f as any).bottom, left: (f as any).left, right: (f as any).right, animationDelay: f.delay, opacity: 0.7, zIndex: 1 }}>
          <Image src={f.src} alt="" width={f.w} height={f.w} className="object-contain" />
        </span>
      ))}

      {/* Nav */}
      <div className="sticky top-0 z-50 px-4 pt-3 sm:px-6">
        <header className="mx-auto flex max-w-4xl items-center justify-between rounded-2xl border px-5 py-3 shadow-xl backdrop-blur-xl"
          style={{ background: "var(--nav-glass)", borderColor: "var(--nav-border)", transition: "background 0.4s ease" }}>
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-bold transition-all hover:scale-105 text-fg-primary">
            <Image src={dark ? "/images/1.png" : "/images/5.png"} alt="" width={22} height={22} className="object-contain" />
            ← Dashboard
          </Link>
          <span className="font-display text-base font-bold italic text-fg-primary hidden sm:block">My Tasks</span>
          <ThemeToggle />
        </header>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-20 sm:px-6">

        {/* Header */}
        <div className="mt-8 mb-6 flex flex-col items-center text-center animate-fade-up">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#CB438B", opacity: 0.75 }}>task manager</p>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">
            <span className="text-fg-primary">Your </span>
            <span className="animate-shimmer italic">Tasks.</span>
          </h1>
          <p className="mt-2 text-sm text-fg-secondary">deadlines don't scare us here.</p>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 rounded-2xl"
                style={{ background: dark ? "rgba(203,67,139,0.10)" : "rgba(203,67,139,0.07)" }} />
            ))}
          </div>
        )}

        {/* Main content (hidden while loading) */}
        {!loading && (<>

        {/* Filters + Add button */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {(["all", "active", "done"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className="rounded-xl px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all"
                style={{
                  background: filter === f ? "linear-gradient(135deg,#CB438B,#BF3556)" : (dark ? "rgba(203,67,139,0.12)" : "rgba(203,67,139,0.09)"),
                  color: filter === f ? "#fff" : "var(--fg-secondary)",
                  border: `1px solid ${filter === f ? "transparent" : inputBdr}`,
                }}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); }}
            className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 animate-pulse-glow"
            style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
            + Add Task
          </button>
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div className="mb-6 animate-fade-up rounded-2xl border p-5 backdrop-blur-xl sm:p-6"
            style={{ background: cardBg, borderColor: cardBdr }}>
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider" style={{ color: "#CB438B" }}>
              {editId ? "Edit Task" : "New Task"}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Title */}
              <input
                required
                placeholder="What do you need to do?"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-[#CB438B]"
                style={{ background: inputBg, borderColor: inputBdr, color: "var(--fg-primary)" }}
              />
              <div className="flex flex-wrap gap-4">
                {/* Deadline */}
                <div className="flex flex-1 flex-col gap-1.5 min-w-[160px]">
                  <label className="text-xs font-bold uppercase tracking-wider text-fg-secondary">Deadline</label>
                  <div className="flex gap-2">
                    {(["Today", "Tomorrow"] as const).map((label) => {
                      const d = new Date();
                      if (label === "Tomorrow") d.setDate(d.getDate() + 1);
                      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                      const active = form.deadline === iso;
                      return (
                        <button key={label} type="button"
                          onClick={() => setForm((f) => ({ ...f, deadline: active ? "" : iso }))}
                          className="rounded-xl px-3 py-2 text-xs font-bold transition-all"
                          style={{
                            background: active ? "linear-gradient(135deg,#CB438B,#BF3556)" : (dark ? "rgba(203,67,139,0.12)" : "rgba(203,67,139,0.09)"),
                            color: active ? "#fff" : "#CB438B",
                            border: `1px solid ${active ? "transparent" : inputBdr}`,
                          }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                    className="rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#CB438B]"
                    style={{ background: inputBg, borderColor: inputBdr, color: "var(--fg-primary)", colorScheme: dark ? "dark" : "light" }}
                  />
                </div>
                {/* Priority */}
                <div className="flex flex-1 flex-col gap-1.5 min-w-[140px]">
                  <label className="text-xs font-bold uppercase tracking-wider text-fg-secondary">Priority</label>
                  <div className="flex gap-2">
                    {PRIORITIES.map((p) => {
                      const m = PRIORITY_META[p];
                      const active = form.priority === p;
                      return (
                        <button key={p} type="button" onClick={() => setForm((f) => ({ ...f, priority: p }))}
                          className="flex-1 rounded-xl py-2 text-xs font-bold transition-all"
                          style={{
                            background: active ? m.color : (dark ? m.darkBg : m.bg),
                            color: active ? "#fff" : m.color,
                            border: `1px solid ${m.color}`,
                          }}>
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={cancelForm}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold text-fg-secondary transition-all hover:scale-105"
                  style={{ border: `1px solid ${inputBdr}`, background: dark ? "rgba(203,67,139,0.08)" : "rgba(203,67,139,0.06)" }}>
                  Cancel
                </button>
                <button type="submit"
                  className="rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
                  {editId ? "Save Changes" : "Add Task"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Task list */}
        {visible.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-4 animate-fade-up opacity-70">
            <Image src="/images/5.png" alt="" width={56} height={56} className="object-contain animate-float-slow" />
            <p className="font-display text-xl italic text-fg-primary">
              {filter === "done" ? "No completed tasks yet." : "No tasks yet — you're free!"}
            </p>
            <p className="text-sm text-fg-secondary">
              {filter === "active" || filter === "all" ? "Add one above and get grinding." : "Check something off the list first."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((task) => {
              const m = PRIORITY_META[task.priority];
              const overdue = task.deadline && !task.done && task.deadline < new Date().toISOString().slice(0, 10);
              return (
                <li key={task.id}
                  className="group flex items-start gap-4 rounded-2xl border p-4 backdrop-blur-xl transition-all duration-200 hover:scale-[1.01]"
                  style={{
                    background: task.done ? (dark ? "rgba(108,106,67,0.10)" : "rgba(108,106,67,0.07)") : cardBg,
                    borderColor: task.done ? (dark ? "rgba(108,106,67,0.20)" : "rgba(108,106,67,0.15)") : cardBdr,
                    opacity: task.done ? 0.7 : 1,
                  }}>
                  {/* Checkbox */}
                  <button onClick={() => handleToggle(task)} aria-label="Toggle done"
                    className="mt-0.5 shrink-0 h-5 w-5 rounded-full border-2 transition-all flex items-center justify-center hover:scale-110"
                    style={{
                      borderColor: task.done ? "#6C6A43" : "#CB438B",
                      background: task.done ? "#6C6A43" : "transparent",
                    }}>
                    {task.done && <span className="text-white text-[10px] font-bold">✓</span>}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-fg-primary leading-snug"
                      style={{ textDecoration: task.done ? "line-through" : "none", opacity: task.done ? 0.6 : 1 }}>
                      {task.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {/* Priority badge */}
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: dark ? m.darkBg : m.bg, color: m.color }}>
                        {m.label}
                      </span>
                      {/* Deadline */}
                      {task.deadline ? (
                        <span className="text-xs text-fg-secondary" style={{ color: overdue ? "#BF3556" : undefined }}>
                          {overdue ? "! " : ""}
                          {new Date(task.deadline + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {overdue ? " — overdue" : ""}
                        </span>
                      ) : (
                        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: dark ? "rgba(108,106,67,0.20)" : "rgba(108,106,67,0.12)", color: "#8b8a5a" }}>
                          Ongoing ∞
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Add to Google Calendar — only for tasks with a deadline */}
                    {gcalConnected && task.deadline && !task.done && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const token = await getToken();
                          if (!token) return;
                          const result = await apiGCalAddEvent(token, { title: task.title, deadline: task.deadline! });
                          if (result) {
                            setAddedToCalIds((prev) => new Set([...prev, task.id]));
                            setToast(`“${task.title}” added to Google Calendar ✓`);
                            setTimeout(() => setToast(null), 4000);
                          }
                        }}
                        title="Add to Google Calendar"
                        aria-label="Add to Google Calendar"
                        className="rounded-lg px-2 py-1 text-xs font-bold transition-all hover:scale-110"
                        style={{ background: dark ? "rgba(66,133,244,0.15)" : "rgba(66,133,244,0.10)", color: addedToCalIds.has(task.id) ? "#4ade80" : "#4285F4" }}>
                        {addedToCalIds.has(task.id) ? "✓ Cal" : "📅"}
                      </button>
                    )}
                    <button onClick={() => startEdit(task)} aria-label="Edit"
                      className="rounded-lg px-2 py-1 text-xs font-bold transition-all hover:scale-110"
                      style={{ background: dark ? "rgba(203,67,139,0.15)" : "rgba(203,67,139,0.10)", color: "#CB438B" }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(task.id)} aria-label="Delete"
                      className="rounded-lg px-2 py-1 text-xs font-bold transition-all hover:scale-110"
                      style={{ background: dark ? "rgba(191,53,86,0.15)" : "rgba(191,53,86,0.10)", color: "#BF3556" }}>
                      Del
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        </>)}
      </div>

      {/* Add to Calendar success toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[999] flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-2xl backdrop-blur-xl animate-fade-up"
          style={{ background: dark ? "rgba(28,11,16,0.96)" : "rgba(255,248,238,0.96)", borderColor: "rgba(66,133,244,0.45)", maxWidth: 360 }}>
          <span className="text-lg">&#x1F4C5;</span>
          <p className="flex-1 text-sm font-semibold" style={{ color: "var(--fg-primary)" }}>{toast}</p>
          <button onClick={() => setToast(null)}
            className="text-lg leading-none opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: "var(--fg-secondary)" }}>&#x00D7;</button>
        </div>
      )}
    </main>
  );
}
