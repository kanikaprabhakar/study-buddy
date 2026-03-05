"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { UserButton, useAuth } from "@clerk/nextjs";
import { useTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Quote } from "@/lib/quoterism";
import {
  fetchTasks,
  apiPatchTask,
  sortTasks,
  PRIORITY_META,
  type Task,
} from "@/lib/tasks";

const FLOATERS = [
  { src: "/images/13.png", w: 110, top: "4%",    left: "1%",   anim: "animate-float-slow",   delay: "0s" },
  { src: "/images/16.png", w: 95,  top: "8%",    right: "2%",  anim: "animate-float-medium", delay: "1.1s" },
  { src: "/images/14.png", w: 85,  top: "38%",   left: "0%",   anim: "animate-float-fast",   delay: "0.6s" },
  { src: "/images/19.png", w: 100, top: "55%",   right: "1%",  anim: "animate-float-slow",   delay: "1.8s" },
  { src: "/images/11.png", w: 80,  bottom: "18%",left: "2%",   anim: "animate-float-medium", delay: "2.3s" },
  { src: "/images/22.png", w: 90,  bottom: "6%", right: "1%",  anim: "animate-float-fast",   delay: "0.3s" },
  { src: "/images/9.png",  w: 70,  top: "72%",   left: "0%",   anim: "animate-float-slow",   delay: "1.5s" },
  { src: "/images/17.png", w: 80,  top: "26%",   right: "0%",  anim: "animate-float-medium", delay: "0.9s" },
] as const;

type Props = { firstName: string | null; lastName: string | null; isNew?: boolean };

export function DashboardShell({ firstName, lastName, isNew }: Props) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const { getToken } = useAuth();

  const first = firstName?.trim() || "";
  const last  = lastName?.trim()  || "";
  const displayName = [first, last].filter(Boolean).join(" ") || "diva";

  // Tasks state (Supabase via backend)
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!token || cancelled) return;
      fetchTasks(token)
        .then((t) => { if (!cancelled) setTasks(t); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Optimistic toggle
  const handleToggle = useCallback(async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    // optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: !t.done } : t));
    try {
      const token = await getToken();
      if (!token) throw new Error("no token");
      const updated = await apiPatchTask(token, taskId, { done: !task.done });
      setTasks((prev) => prev.map((t) => t.id === taskId ? updated : t));
    } catch {
      // revert on failure
      setTasks((prev) => prev.map((t) => t.id === taskId ? task : t));
    }
  }, [tasks, getToken]);

  // Send welcome email once for new users
  useEffect(() => {
    if (!isNew) return;
    const key = "sb-welcome-sent";
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    fetch("/api/send-welcome", { method: "POST" }).catch(() => {});
  }, [isNew]);

  // Live focus timer from localStorage
  type FocusSnap = { timeLeft: number; mode: string; running: boolean; ts: number } | null;
  const [focusSnap, setFocusSnap] = useState<FocusSnap>(null);
  const [liveTime, setLiveTime]   = useState(0);

  const readFocusSnap = useCallback(() => {
    try {
      const raw = localStorage.getItem("sb_focus_timer");
      if (!raw) { setFocusSnap(null); return; }
      const s = JSON.parse(raw) as FocusSnap & {};
      setFocusSnap(s);
    } catch {}
  }, []);

  useEffect(() => {
    readFocusSnap();
    // Poll every second so the countdown is live even from dashboard
    const poll = setInterval(readFocusSnap, 1000);
    // Also react immediately when focus tab writes to storage
    const onStorage = (e: StorageEvent) => { if (e.key === "sb_focus_timer") readFocusSnap(); };
    window.addEventListener("storage", onStorage);
    return () => { clearInterval(poll); window.removeEventListener("storage", onStorage); };
  }, [readFocusSnap]);

  // Compute live seconds — just use stored value; focus page saves every second while open.
  // If ts is older than 5 seconds and still marked running, the focus tab is closed → treat as paused.
  const isTimerStale = !!(focusSnap?.running && Date.now() - (focusSnap?.ts ?? 0) > 5000);
  const isTimerLive  = !!(focusSnap?.running && !isTimerStale);
  useEffect(() => {
    if (!focusSnap) return;
    setLiveTime(focusSnap.timeLeft);
  }, [focusSnap]);

  function fmtTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden animate-gradient-bg">

      {/* Blobs */}
      <div aria-hidden className="pointer-events-none fixed top-[-100px] left-[-100px] h-[400px] w-[400px] rounded-full blur-3xl opacity-25 animate-float-slow"   style={{ background: "#CB438B" }} />
      <div aria-hidden className="pointer-events-none fixed top-[30%] right-[-120px] h-[340px] w-[340px] rounded-full blur-3xl opacity-18 animate-float-medium" style={{ background: "#BF3556" }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[12%] left-[6%] h-[260px] w-[260px] rounded-full blur-3xl opacity-15 animate-float-fast"    style={{ background: "#6C6A43" }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[-80px] right-[10%] h-[360px] w-[360px] rounded-full blur-3xl opacity-22 animate-float-slow" style={{ background: "#4D3449" }} />

      {/* Floating images */}
      {FLOATERS.map((f, i) => (
        <span
          key={i}
          aria-hidden
          className={`pointer-events-none fixed ${f.anim}`}
          style={{
            top: (f as any).top,
            bottom: (f as any).bottom,
            left: (f as any).left,
            right: (f as any).right,
            animationDelay: f.delay,
            opacity: 0.72,
            zIndex: 1,
          }}
        >
          <Image src={f.src} alt="" width={f.w} height={f.w} className="object-contain" />
        </span>
      ))}

      {/* ── Nav ── */}
      <div className="sticky top-0 z-50 px-4 pt-3 sm:px-6">
        <header
          className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border px-5 py-3 shadow-xl backdrop-blur-xl"
          style={{
            background: "var(--nav-glass)",
            borderColor: "var(--nav-border)",
            transition: "background 0.4s ease, border-color 0.4s ease",
          }}
        >
          {/* Brand + nav dropdown grouped left */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src={dark ? "/images/1.png" : "/images/5.png"}
                alt="Zenith"
                width={28}
                height={28}
                className="object-contain"
              />
              <span className="font-display text-lg font-bold italic text-fg-primary hidden sm:block">
                Zenith
              </span>
            </Link>
            <NavDropdown dark={dark} />
          </div>

          <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{
              variables: {
                colorPrimary:       "#CB438B",
                colorBackground:    dark ? "#200B12" : "#FFF0D2",
                colorText:          dark ? "#FFE5D0" : "#4D3449",
                colorTextSecondary: dark ? "#C9A595" : "#6C6A43",
                colorNeutral:       dark ? "#FFE5D0" : "#4D3449",
                borderRadius:       "1rem",
              },
              elements: {
                avatarBox: `ring-2 ring-[#CB438B] ring-offset-2 ${dark ? "ring-offset-[#1C0B10]" : "ring-offset-white"}`,
                userButtonPopoverCard: `border shadow-xl ${dark ? "border-[rgba(203,67,139,0.30)] bg-[#200B12]" : "border-[rgba(203,67,139,0.18)] bg-[#FFF8EE]"}`,
                userButtonPopoverActions: dark ? "bg-[#2A0E15]" : "bg-[#FFF0D2]",
              },
            }}
          />
          </div>
        </header>
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">

        {/* Welcome hero */}
        <div className="mt-10 mb-10 flex flex-col items-center text-center animate-fade-up">
          <p
            className="mb-1 text-xs font-bold uppercase tracking-[0.25em]"
            style={{ color: "#CB438B", opacity: 0.75 }}
          >
            dashboard
          </p>
          <h1 className="font-display text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl">
            <span className="text-fg-primary">Welcome back,</span>{" "}
            <span className="animate-shimmer font-bold italic">{displayName}.</span>
          </h1>
          <p className="mt-3 max-w-sm text-base text-fg-secondary">
            Ready to grind? Your study space is all set.
          </p>
        </div>

        {/* ── Quote of the Day — full width feature ── */}
        <div
          className="mb-6 animate-fade-up rounded-3xl border p-6 sm:p-8 backdrop-blur-xl"
          style={{ background: "var(--nav-glass)", borderColor: "var(--nav-border)" }}
        >
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em]" style={{ color: "#CB438B", opacity: 0.8 }}>
            quote of the day
          </p>
          <DashQuote dark={dark} />
        </div>

        {/* ── 2-col grid ── */}
        <div className="grid gap-5 md:grid-cols-2">

          {/* Tasks mini-view */}
          <DashCard title="My Tasks" href="/tasks">
            <MiniTasks tasks={tasks} dark={dark} onToggle={handleToggle} />
          </DashCard>

          {/* Pomodoro */}
          <DashCard title="Focus Timer" href="/focus">
            {isTimerLive ? (
              /* Live timer view */
              <div className="flex items-center gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-bg-page animate-pulse" style={{ background: "#4ade80" }} />
                  <span className="font-display text-sm font-bold text-white tabular-nums">{fmtTime(liveTime)}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-fg-primary">Timer Running</p>
                  <p className="text-xs text-fg-secondary capitalize">{focusSnap?.mode === "focus" ? "Focus session" : "Break time"}</p>
                </div>
              </div>
            ) : focusSnap && !focusSnap.running ? (
              /* Paused with saved time */
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg,rgba(203,67,139,0.6),rgba(191,53,86,0.6))" }}>
                  <span className="font-display text-sm font-bold text-white tabular-nums">{fmtTime(liveTime)}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-fg-primary">Timer Paused</p>
                  <p className="text-xs text-fg-secondary capitalize">{focusSnap.mode === "focus" ? "Focus session" : "Break time"}</p>
                </div>
              </div>
            ) : (
              /* Default idle view */
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
                  <span className="text-2xl font-bold text-white">25</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-fg-primary">Pomodoro</p>
                  <p className="text-xs text-fg-secondary">25 min focus · 5 min break</p>
                </div>
              </div>
            )}
            <Link
              href="/focus"
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 mt-4 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 animate-pulse-glow"
              style={{ background: "linear-gradient(135deg,#CB438B 0%,#BF3556 100%)" }}
            >
              {isTimerLive ? "Open Timer" : focusSnap ? "Resume Session" : "▶ Start Session"}
            </Link>
          </DashCard>

          {/* Weekly progress — spans both cols */}
          <div className="md:col-span-2">
            <DashCard title="Weekly Progress">
              <div className="space-y-3">
                <div
                  className="h-3 w-full overflow-hidden rounded-full"
                  style={{ background: dark ? "rgba(203,67,139,0.18)" : "rgba(203,67,139,0.12)" }}
                  role="progressbar"
                  aria-label="Weekly study progress"
                  aria-valuenow={40}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: "40%", background: "linear-gradient(90deg,#CB438B,#BF3556)" }}
                  />
                </div>
                <p className="text-sm text-fg-secondary">2 / 5 study days completed this week</p>
              </div>
            </DashCard>
          </div>

        </div>
      </div>
    </main>
  );
}

/* ─── Pages nav dropdown ─── */
const NAV_PAGES = [
  { href: "/tasks",  label: "Tasks",       img: "/images/15.png",  sub: "Manage your to-dos" },
  { href: "/focus",  label: "Focus Timer", img: "/images/17.png",  sub: "Pomodoro sessions" },
] as const;

function NavDropdown({ dark }: { dark: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Trigger — image icon + subtle caret */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open pages menu"
        className="group flex items-center gap-1.5 rounded-2xl p-1.5 transition-all hover:scale-110"
        style={{
          background: open ? (dark ? "rgba(203,67,139,0.18)" : "rgba(203,67,139,0.13)") : "transparent",
          outline: open ? `2px solid rgba(203,67,139,0.4)` : "2px solid transparent",
        }}
      >
        <Image
          src="/images/13.png"
          alt="nav"
          width={34}
          height={34}
          className="object-contain drop-shadow transition-transform group-hover:rotate-6"
        />
        <svg width="9" height="9" viewBox="0 0 9 9" fill="#CB438B"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}>
          <path d="M4.5 6.5l-4-4h8l-4 4z" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute left-0 top-[calc(100%+10px)] w-56 rounded-2xl border shadow-2xl backdrop-blur-2xl overflow-hidden z-50"
          style={{ background: dark ? "rgba(20,6,12,0.92)" : "rgba(255,246,232,0.96)", borderColor: "rgba(203,67,139,0.25)" }}
        >
          <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#CB438B", opacity: 0.7 }}>
            Pages
          </p>
          {NAV_PAGES.map((p, i) => (
            <Link
              key={p.href}
              href={p.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 mx-2 mb-1 rounded-xl transition-all hover:scale-[1.02]"
              style={{ background: dark ? "rgba(203,67,139,0.07)" : "rgba(203,67,139,0.05)" }}
            >
              <Image src={p.img} alt="" width={36} height={36} className="object-contain shrink-0" />
              <div>
                <p className="text-sm font-bold text-fg-primary">{p.label}</p>
                <p className="text-[11px] text-fg-secondary">{p.sub}</p>
              </div>
            </Link>
          ))}
          <div className="h-2" />
        </div>
      )}
    </div>
  );
}

/* ─── Mini task checklist on dashboard ─── */
function MiniTasks({
  tasks,
  dark,
  onToggle,
}: {
  tasks: Task[];
  dark: boolean;
  onToggle: (id: string) => void;
}) {
  const sorted = sortTasks(tasks).slice(0, 5); // show top 5

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 opacity-70">
        <p className="text-sm italic text-fg-secondary">No tasks yet — clean slate!</p>
        <Link
          href="/tasks"
          className="relative z-10 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}
        >
          + Add your first task
        </Link>
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-2">
        {sorted.map((task) => {
          const m = PRIORITY_META[task.priority];
          return (
            <li key={task.id} className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
                aria-label="Toggle"
                className="relative z-10 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110"
                style={{
                  borderColor: task.done ? "#6C6A43" : "#CB438B",
                  background: task.done ? "#6C6A43" : "transparent",
                }}
              >
                {task.done && <span className="text-white text-[10px] font-bold">✓</span>}
              </button>
              <span
                className="flex-1 truncate text-sm"
                style={{
                  color: "var(--fg-primary)",
                  textDecoration: task.done ? "line-through" : "none",
                  opacity: task.done ? 0.5 : 1,
                }}
              >
                {task.title}
              </span>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: dark ? m.darkBg : m.bg, color: m.color }}
              >
                {m.label}
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        href="/tasks"
        className="relative z-10 mt-4 inline-flex items-center gap-1 text-xs font-bold transition-all hover:scale-105"
        style={{ color: "#CB438B" }}
        onClick={(e) => e.stopPropagation()}
      >
        View all {tasks.length} task{tasks.length !== 1 ? "s" : ""} →
      </Link>
    </div>
  );
}

/* ─── tiny card wrapper ─── */
function DashCard({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="relative rounded-2xl border p-5 backdrop-blur-xl sm:p-6 transition-colors duration-400"
      style={{
        background: "var(--nav-glass)",
        borderColor: "var(--nav-border)",
        cursor: href ? "pointer" : "default",
      }}
    >
      {/* Full-card link overlay (below content so interactive children still work) */}
      {href && (
        <Link
          href={href}
          className="absolute inset-0 rounded-2xl z-0"
          aria-label={title}
          tabIndex={-1}
        />
      )}
      <h2
        className="relative z-10 mb-4 flex items-center gap-2 text-base font-bold uppercase tracking-wider"
        style={{ color: "#CB438B" }}
      >
        {title}
      </h2>
      <div className="relative z-10">{children}</div>
    </section>
  );
}

/* ─── live daily quote ─── */
const FALLBACK: Quote = {
  id: "fallback",
  text: "Small progress is still progress.",
  author: { id: "fallback", name: "Zenith" },
};

function DashQuote({ dark }: { dark: boolean }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ok"; quote: Quote }
    | { status: "error"; quote: Quote }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/quote?id=quote-of-the-day")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<Quote>;
      })
      .then((quote) => { if (!cancelled) setState({ status: "ok", quote }); })
      .catch(()   => { if (!cancelled) setState({ status: "error", quote: FALLBACK }); });
    return () => { cancelled = true; };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <div className="h-8 w-4/5 animate-pulse rounded-xl" style={{ background: dark ? "rgba(203,67,139,0.15)" : "rgba(203,67,139,0.10)" }} />
        <div className="h-8 w-3/5 animate-pulse rounded-xl" style={{ background: dark ? "rgba(203,67,139,0.10)" : "rgba(203,67,139,0.07)" }} />
        <div className="h-5 w-36 animate-pulse rounded-full" style={{ background: dark ? "rgba(203,67,139,0.08)" : "rgba(203,67,139,0.05)" }} />
      </div>
    );
  }

  const q = state.quote;
  return (
    <blockquote>
      <p className="font-display text-2xl font-bold italic leading-snug text-fg-primary sm:text-3xl lg:text-4xl">
        &ldquo;{q.text}&rdquo;
      </p>
      <footer className="mt-4 text-sm font-semibold not-italic text-fg-secondary">
        — {q.author.name}
      </footer>
    </blockquote>
  );
}
