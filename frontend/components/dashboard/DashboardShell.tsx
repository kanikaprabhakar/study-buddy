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
  fetchWeekStudyDays,
  fetchDaySummary,
  sortTasks,
  PRIORITY_META,
  type Task,
  type Resource,
  type GCalEvent,
  type DaySummary,
  fetchResources,
  fetchGCalStatus,
  fetchGCalAuthUrl,
  fetchGCalEvents,
  apiGCalDisconnect,
  fetchNotes,
  apiCreateNote,
  type Note,
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

/** Local-timezone YYYY-MM-DD — avoids UTC offset shifting the date */
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!token || cancelled) return;
      fetchNotes(token)
        .then((n) => { if (!cancelled) setNotes(n); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resources state
  const [resources, setResources] = useState<Resource[]>([]);
  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!token || cancelled) return;
      fetchResources(token)
        .then((r) => { if (!cancelled) setResources(r); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Google Calendar state
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEmail,     setGcalEmail]     = useState<string | null>(null);
  const [gcalEvents,    setGcalEvents]    = useState<GCalEvent[]>([]);
  const [gcalLoading,   setGcalLoading]   = useState(true);
  useEffect(() => {
    let cancelled = false;
    getToken().then(async (token) => {
      if (!token || cancelled) return;
      const { connected, gcalEmail: email } = await fetchGCalStatus(token);
      if (cancelled) return;
      setGcalConnected(connected);
      if (email) setGcalEmail(email);
      setGcalLoading(false);
      if (connected) {
        const events = await fetchGCalEvents(token, 7);
        if (!cancelled) setGcalEvents(events);
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle ?gcal=connected query param (after OAuth redirect)
  useEffect(() => {
    const url = new URL(window.location.href);
    const gcalParam = url.searchParams.get("gcal");
    if (!gcalParam) return;
    url.searchParams.delete("gcal");
    window.history.replaceState({}, "", url.toString());
    if (gcalParam === "connected") {
      setGcalConnected(true);
      getToken().then(async (token) => {
        if (!token) return;
        const { gcalEmail: email } = await fetchGCalStatus(token);
        if (email) setGcalEmail(email);
        fetchGCalEvents(token, 7).then(setGcalEvents).catch(() => {});
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Weekly study days from backend (focus sessions) + localStorage (task completions)
  const [weekDays, setWeekDays] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;

    // Compute local week's Monday (Mon=0 ... Sun=6)
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    const mondayISO = localISO(monday);
    const sundayDate = new Date(monday);
    sundayDate.setDate(monday.getDate() + 6);
    const sundayISO = localISO(sundayDate);

    // Get days from backend (focus sessions), passing local week start for timezone-correct filtering
    getToken().then((token) => {
      if (!token || cancelled) return;
      fetchWeekStudyDays(token, mondayISO)
        .then((days) => {
          if (cancelled) return;
          setWeekDays((prev) => new Set([...prev, ...days]));
        })
        .catch(() => {});
    });

    // Also read localStorage study_days (task completions marked there)
    try {
      const raw = localStorage.getItem("zenith_study_days");
      if (raw) {
        const stored: string[] = JSON.parse(raw);
        // Compare ISO strings directly — no Date parsing, no timezone issues
        const thisWeek = stored.filter((d) => d >= mondayISO && d <= sundayISO);
        if (thisWeek.length > 0) {
          setWeekDays((prev) => new Set([...prev, ...thisWeek]));
        }
      }
    } catch {}

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Optimistic toggle
  const handleToggle = useCallback(async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    // optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: !t.done } : t));
    // if completing a task, mark today as a study day
    if (!task.done) {
      try {
        const today = localISO(new Date());
        const raw = localStorage.getItem("zenith_study_days");
        const days: string[] = raw ? JSON.parse(raw) : [];
        if (!days.includes(today)) {
          days.push(today);
          localStorage.setItem("zenith_study_days", JSON.stringify(days.slice(-30)));
          setWeekDays((prev) => new Set([...prev, today]));
        }
      } catch {}
    }
    try {
      const token = await getToken();
      if (!token) throw new Error("no token");
      const updated = await apiPatchTask(token, taskId, {
        done: !task.done,
        ...(!task.done ? { completed_on: localISO(new Date()) } : {}),
      });
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
  const liveTime     = focusSnap?.timeLeft ?? 0;

  function fmtTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  }
  // Live clock — ticks every second
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Day-review panel for Weekly Progress
  const [selectedDay,       setSelectedDay]       = useState<string | null>(null);
  const [daySummary,        setDaySummary]        = useState<DaySummary | null>(null);
  const [daySummaryLoading, setDaySummaryLoading] = useState(false);
  const handleDayClick = useCallback(async (iso: string) => {
    if (selectedDay === iso) { setSelectedDay(null); return; } // toggle off
    setSelectedDay(iso);
    setDaySummaryLoading(true);
    const token = await getToken();
    if (!token) { setDaySummaryLoading(false); return; }
    try {
      const summary = await fetchDaySummary(token, iso);
      setDaySummary(summary);
    } catch {
      setDaySummary({ tasks: [], sessions: [] });
    } finally {
      setDaySummaryLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, getToken]);
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
        <div className="mt-10 mb-4 flex flex-col items-center text-center animate-fade-up">
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

        {/* ── Live date & time ── */}
        <div className="mb-8 animate-fade-up flex flex-col items-center gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="font-display text-3xl font-bold text-fg-primary sm:text-4xl">
            {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <p className="font-display text-2xl font-bold tabular-nums sm:text-3xl" style={{ color: "#CB438B" }}>
            {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
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

          {/* Resources compact */}
          <DashCard title="Resources" href="/resources">
            <MiniResources resources={resources} dark={dark} />
          </DashCard>

          {/* Weekly progress — spans both cols */}
          <div className="md:col-span-2">
            <DashCard title="Weekly Progress">
              <WeeklyProgress
                weekDays={weekDays}
                dark={dark}
                selectedDay={selectedDay}
                onDayClick={handleDayClick}
                daySummary={daySummary}
                daySummaryLoading={daySummaryLoading}
              />
            </DashCard>
          </div>

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

          {/* Notes */}
          <DashCard title="Notes" href="/notes">
            <MiniNotes notes={notes} dark={dark} getToken={getToken} onCreated={(note) => setNotes((prev) => [note, ...prev])} />
          </DashCard>

          {/* Google Calendar */}
          <DashCard title="Google Calendar">
            <GCalWidget
              connected={gcalConnected}
              gcalEmail={gcalEmail}
              events={gcalEvents}
              loading={gcalLoading}
              dark={dark}
              onConnect={async () => {
                const token = await getToken();
                if (!token) return;
                const url = await fetchGCalAuthUrl(token);
                if (url) window.location.href = url;
              }}
              onDisconnect={async () => {
                const token = await getToken();
                if (!token) return;
                await apiGCalDisconnect(token);
                setGcalConnected(false);
                setGcalEmail(null);
                setGcalEvents([]);
              }}
            />
          </DashCard>

        </div>
      </div>
    </main>
  );
}

/* ─── Pages nav dropdown ─── */
const NAV_PAGES = [
  { href: "/tasks",     label: "Tasks",       img: "/images/15.png", sub: "Manage your to-dos" },
  { href: "/focus",     label: "Focus Timer", img: "/images/17.png", sub: "Pomodoro sessions" },
  { href: "/resources", label: "Resources",   img: "/images/14.png", sub: "Your bookmarks" },
  { href: "/notes",     label: "Notes",       img: "/images/20.png", sub: "Your writing space" },
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
        className="group flex items-center gap-1.5 rounded-2xl p-1.5 transition-all hover:scale-110 cursor-pointer"
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
                className="relative z-10 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
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
              {task.deadline ? (
                <span className="shrink-0 text-[10px] text-fg-secondary">
                  {new Date(task.deadline + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              ) : (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: dark ? "rgba(108,106,67,0.20)" : "rgba(108,106,67,0.12)", color: "#8b8a5a" }}>
                  ∞
                </span>
              )}
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

/* ─── Weekly Progress ─── */
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function WeeklyProgress({
  weekDays, dark, selectedDay, onDayClick, daySummary, daySummaryLoading,
}: {
  weekDays: Set<string>;
  dark: boolean;
  selectedDay: string | null;
  onDayClick: (iso: string) => void;
  daySummary: DaySummary | null;
  daySummaryLoading: boolean;
}) {
  const monday = (() => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const days = WEEK_DAYS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = localISO(d);
    const isToday = iso === localISO(new Date());
    const studied = weekDays.has(iso);
    const isPast  = d < new Date() && !isToday;
    return { label, iso, studied, isToday, isPast };
  });

  const studiedCount = days.filter((d) => d.studied).length;
  const pct = Math.round((studiedCount / 7) * 100);

  return (
    <div className="space-y-4">
      {/* Clickable day bars */}
      <div className="flex items-end justify-between gap-1">
        {days.map(({ label, iso, studied, isToday, isPast }) => {
          const isSelected = selectedDay === iso;
          return (
            <button
              key={label}
              onClick={() => onDayClick(iso)}
              title={iso}
              className="flex flex-1 flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
            >
              <div
                className="w-full rounded-xl transition-all duration-300"
                style={{
                  height: 36,
                  background: studied
                    ? "linear-gradient(135deg,#CB438B,#BF3556)"
                    : isToday
                    ? (dark ? "rgba(203,67,139,0.22)" : "rgba(203,67,139,0.15)")
                    : (dark ? "rgba(203,67,139,0.09)" : "rgba(203,67,139,0.06)"),
                  boxShadow: isSelected
                    ? "0 0 0 2.5px #CB438B, 0 0 18px rgba(203,67,139,0.55)"
                    : studied ? "0 0 12px rgba(203,67,139,0.40)" : "none",
                  outline: isToday && !isSelected ? "2px solid rgba(203,67,139,0.45)" : "none",
                  outlineOffset: 2,
                  opacity: isPast && !studied ? 0.5 : 1,
                  transform: isSelected ? "scaleY(1.12)" : "scaleY(1)",
                }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-wide"
                style={{ color: isSelected || isToday ? "#CB438B" : "var(--fg-secondary)", opacity: isSelected || isToday ? 1 : 0.75 }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div
          className="animate-fade-up rounded-2xl border p-4 text-sm"
          style={{
            background: dark ? "rgba(203,67,139,0.07)" : "rgba(203,67,139,0.04)",
            borderColor: dark ? "rgba(203,67,139,0.22)" : "rgba(203,67,139,0.15)",
          }}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#CB438B" }}>
            {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          {daySummaryLoading ? (
            <div className="space-y-2 animate-pulse">
              {[70, 50, 85].map((w, i) => (
                <div key={i} className="h-4 rounded-xl"
                  style={{ width: `${w}%`, background: dark ? "rgba(203,67,139,0.15)" : "rgba(203,67,139,0.10)" }} />
              ))}
            </div>
          ) : !daySummary || (daySummary.sessions.length === 0 && daySummary.tasks.length === 0) ? (
            <p className="italic text-fg-secondary opacity-60">No activity logged for this day.</p>
          ) : (
            <div className="space-y-3">
              {daySummary.sessions.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#CB438B", opacity: 0.65 }}>Study Sessions</p>
                  <ul className="space-y-1">
                    {daySummary.sessions.map((s) => (
                      <li key={s.id} className="flex items-center gap-2">
                        <span className="text-base leading-none">⏱</span>
                        <span className="font-semibold text-fg-primary">{s.durationMin} min</span>
                        <span className="text-fg-secondary capitalize">{s.mode}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {daySummary.tasks.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#CB438B", opacity: 0.65 }}>Tasks Completed</p>
                  <ul className="space-y-1">
                    {daySummary.tasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white text-[9px] font-bold"
                          style={{ background: "#6C6A43" }}>✓</span>
                        <span className="text-fg-primary">{t.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: dark ? "rgba(203,67,139,0.18)" : "rgba(203,67,139,0.12)" }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg,#CB438B,#BF3556)" }}
        />
      </div>

      <p className="text-sm text-fg-secondary">
        {studiedCount === 0
          ? "No study days logged yet this week — let's go! 🚀"
          : studiedCount === 7
          ? "Perfect week! Every single day. You're unstoppable 🔥"
          : `${studiedCount} / 7 days studied this week${studiedCount >= 5 ? " 🔥" : studiedCount >= 3 ? " ✨" : ""}`}
      </p>
    </div>
  );
}

/* ─── Mini Resources widget ─── */
function MiniResources({ resources, dark }: { resources: Resource[]; dark: boolean }) {
  const top = resources.slice(0, 4);

  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 opacity-70">
        <p className="text-sm italic text-fg-secondary">No resources saved yet.</p>
        <Link href="/resources"
          className="relative z-10 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
          + Add first bookmark
        </Link>
      </div>
    );
  }

  function getFavicon(url: string) {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; }
    catch { return null; }
  }

  return (
    <div>
      <ul className="space-y-2">
        {top.map((r) => {
          const favicon = getFavicon(r.url);
          let hostname = "";
          try { hostname = new URL(r.url).hostname.replace(/^www\./, ""); } catch { hostname = r.url; }
          return (
            <li key={r.id} className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: dark ? "rgba(203,67,139,0.12)" : "rgba(203,67,139,0.08)" }}>
                {favicon
                  ? <img src={favicon} alt="" width={14} height={14} className="rounded" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  : <span style={{ fontSize: 12 }}>🔗</span>}
              </div>
              <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                className="flex-1 truncate text-sm font-semibold hover:underline"
                style={{ color: "var(--fg-primary)" }}>
                {r.name}
              </a>
              <span className="shrink-0 text-[10px] text-fg-secondary" style={{ opacity: 0.6 }}>
                {hostname}
              </span>
            </li>
          );
        })}
      </ul>
      <Link href="/resources"
        className="relative z-10 mt-4 inline-flex items-center gap-1 text-xs font-bold transition-all hover:scale-105"
        style={{ color: "#CB438B" }}
        onClick={(e) => e.stopPropagation()}>
        View all {resources.length} resource{resources.length !== 1 ? "s" : ""} →
      </Link>
    </div>
  );
}

/* ─── Mini Notes widget ─── */
function MiniNotes({
  notes, dark, getToken, onCreated,
}: {
  notes: Note[];
  dark: boolean;
  getToken: () => Promise<string | null>;
  onCreated: (note: Note) => void;
}) {
  const [creating, setCreating] = useState(false);

  async function handleNewNote(e: React.MouseEvent) {
    e.stopPropagation();
    if (creating) return;
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) return;
      const note = await apiCreateNote(token, { heading: "Untitled", content: "" });
      onCreated(note);
      // Navigate to editor
      window.location.href = `/notes/${note.id}`;
    } catch {
      setCreating(false);
    }
  }

  const recent = notes.slice(0, 3);

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 opacity-70">
        <p className="text-sm italic text-fg-secondary">No notes yet — start writing!</p>
        <button onClick={handleNewNote} disabled={creating}
          className="relative z-10 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:scale-105 cursor-pointer disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
          {creating ? "Creating…" : "+ New Note"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-2">
        {recent.map((n) => (
          <li key={n.id}>
            <Link href={`/notes/${n.id}`} onClick={(e) => e.stopPropagation()}
              className="flex items-start gap-2 rounded-xl p-2 transition-all hover:scale-[1.01] group"
              style={{ background: dark ? "rgba(203,67,139,0.06)" : "rgba(203,67,139,0.04)" }}>
              <span className="mt-0.5 shrink-0 text-base leading-none">📝</span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-fg-primary group-hover:underline">{n.heading}</p>
                {n.description && (
                  <p className="truncate text-[11px] text-fg-secondary opacity-70">{n.description}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between">
        <Link href="/notes"
          className="relative z-10 text-xs font-bold transition-all hover:scale-105"
          style={{ color: "#CB438B" }}
          onClick={(e) => e.stopPropagation()}>
          View all {notes.length} note{notes.length !== 1 ? "s" : ""} →
        </Link>
        <button onClick={handleNewNote} disabled={creating}
          className="relative z-10 rounded-xl px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:scale-105 cursor-pointer disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
          {creating ? "…" : "+ New"}
        </button>
      </div>
    </div>
  );
}

/* ─── Google Calendar widget ─── */
function GCalWidget({
  connected, gcalEmail, events, loading, dark, onConnect, onDisconnect,
}: {
  connected: boolean;
  gcalEmail: string | null;
  events: GCalEvent[];
  loading: boolean;
  dark: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[60, 80, 50].map((w, i) => (
          <div key={i} className="h-5 rounded-xl"
            style={{ width: `${w}%`, background: dark ? "rgba(203,67,139,0.12)" : "rgba(203,67,139,0.08)" }} />
        ))}
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <p className="text-sm text-fg-secondary">Connect Google Calendar to see upcoming events and add tasks directly.</p>
        <button onClick={onConnect}
          className="relative z-10 flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 cursor-pointer"
          style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Connect Google Calendar
        </button>
      </div>
    );
  }

  // Build embedded calendar URL when we have the user's Google account email
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const embedUrl = gcalEmail
    ? `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(gcalEmail)}&ctz=${encodeURIComponent(tz)}&showNav=1&showTitle=0&showPrint=0&showTabs=1&showCalendars=0&showTz=0&mode=AGENDA`
    : null;

  return (
    <div>
      {embedUrl ? (
        <iframe
          src={embedUrl}
          title="Google Calendar"
          className="w-full rounded-xl"
          style={{
            height: 320,
            border: "none",
            borderRadius: 12,
            // Google Calendar embed has no native dark mode — invert + hue-rotate fakes it cleanly
            filter: dark ? "invert(1) hue-rotate(180deg)" : "none",
            colorScheme: "light",
          }}
        />
      ) : events.length === 0 ? (
        <p className="text-sm italic text-fg-secondary opacity-70">No upcoming events in the next 7 days.</p>
      ) : (
        <ul className="space-y-2">
          {events.slice(0, 4).map((ev) => {
            const date = ev.start
              ? new Date(ev.start).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(!ev.isAllDay && { hour: "numeric", minute: "2-digit" }) })
              : null;
            return (
              <li key={ev.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)", color: "#fff" }}>
                  {date ? date.split(" ")[1] : "·"}
                </span>
                <div className="flex-1 min-w-0">
                  <a href={ev.link ?? "#"} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-semibold truncate block hover:underline"
                    style={{ color: "var(--fg-primary)" }}>
                    {ev.title}
                  </a>
                  {date && <p className="text-[11px] text-fg-secondary">{date}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <button onClick={onDisconnect}
        className="relative z-10 mt-4 text-[11px] font-bold text-fg-secondary opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
        style={{ color: "#BF3556" }}>
        Disconnect Calendar
      </button>
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
