"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { useTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fetchTasks, apiPatchTask, apiCreateTask, sortTasks, PRIORITY_META, type Task } from "@/lib/tasks";

/* ── Background images ── */
const BACKGROUNDS = [
  { src: "/backgrounds/download%20(4).jfif",  label: "Study Desk" },
  { src: "/backgrounds/download%20(5).jfif",  label: "Cozy Room" },
  { src: "/backgrounds/download%20(6).jfif",  label: "Night Vibes" },
  { src: "/backgrounds/download%20(7).jfif",  label: "Soft Focus" },
  { src: "/backgrounds/sticker%20laptop%20acer%20_%20my%20macbook%20wallpaper.jfif", label: "Laptop Sticker" },
] as const;

/* ── Floating sticker images ── */
const FLOATERS = [
  { src: "/images/16.png", w: 80,  top: "6%",    left: "0%",   anim: "animate-float-slow",   delay: "0s" },
  { src: "/images/21.png", w: 70,  top: "20%",   right: "0%",  anim: "animate-float-medium", delay: "1.3s" },
  { src: "/images/13.png", w: 75,  bottom: "22%",left: "0%",   anim: "animate-float-fast",   delay: "0.7s" },
  { src: "/images/23.png", w: 72,  bottom: "8%", right: "0%",  anim: "animate-float-slow",   delay: "1.9s" },
] as const;

/* ── Timer modes ── */
type Mode = "focus" | "short" | "long";
const MODE_LABELS: Record<Mode, string> = { focus: "Focus", short: "Short Break", long: "Long Break" };

/* ── Default settings ── */
const DEFAULT_SETTINGS = { focus: 25, short: 5, long: 15, autoStart: false };

function secsForMode(mode: Mode, settings: typeof DEFAULT_SETTINGS): number {
  const mins = mode === "focus" ? settings.focus : mode === "short" ? settings.short : settings.long;
  return mins * 60;
}
function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* ── Web Audio ding (no file needed) ── */
function playDing() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.9);
    osc.onended = () => ctx.close();
  } catch {
    // browser may block AudioContext without user gesture — silently ignore
  }
}

/* ── Quick task type ── */
interface QuickTask { id: string; title: string; done: boolean }

/* ── LocalStorage key ── */
const STORAGE_KEY = "sb_focus_timer";

export default function FocusPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const { getToken } = useAuth();

  /* ── Background ── */
  const [bgIdx, setBgIdx] = useState(0);

  /* ── Timer state ── */
  const [mode, setMode]           = useState<Mode>("focus");
  const [settings, setSettings]   = useState(DEFAULT_SETTINGS);
  const [timeLeft, setTimeLeft]   = useState(DEFAULT_SETTINGS.focus * 60);
  const [running, setRunning]     = useState(false);
  const [sessions, setSessions]   = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  /* ── Stable refs so callbacks never go stale ── */
  const settingsRef  = useRef(settings);
  const modeRef      = useRef(mode);
  const sessionsRef  = useRef(sessions);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const mainRef      = useRef<HTMLElement>(null);
  const restoredRef  = useRef(false);
  const pipWindowRef = useRef<any>(null);
  const [pipOpen, setPipOpen]           = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  useEffect(() => { setPipSupported("documentPictureInPicture" in window); }, []);
  const runningRef   = useRef(running);
  useEffect(() => { runningRef.current = running; }, [running]);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  /* ── Restore from localStorage on first mount ── */
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as {
        timeLeft: number; mode: Mode; sessions: number; bgIdx: number;
        settings: typeof DEFAULT_SETTINGS; running: boolean; ts: number;
      };
      const elapsed = s.running ? Math.floor((Date.now() - s.ts) / 1000) : 0;
      const restored = Math.max(0, s.timeLeft - elapsed);
      if (s.settings) { setSettings(s.settings); settingsRef.current = s.settings; }
      if (s.bgIdx != null) setBgIdx(s.bgIdx);
      setSessions(s.sessions ?? 0); sessionsRef.current = s.sessions ?? 0;
      setMode(s.mode ?? "focus"); modeRef.current = s.mode ?? "focus";
      if (restored > 0) {
        setTimeLeft(restored);
        if (s.running) setRunning(true);
      } else {
        setTimeLeft(secsForMode(s.mode ?? "focus", s.settings ?? DEFAULT_SETTINGS));
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Persist to localStorage whenever key state changes ── */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        timeLeft, mode, sessions, bgIdx, settings, running, ts: Date.now(),
      }));
    } catch {}
  }, [timeLeft, mode, sessions, bgIdx, settings, running]);

  /* ── Update document.title with countdown (visible in tab bar) ── */
  useEffect(() => {
    if (running) {
      document.title = `${fmt(timeLeft)} · ${MODE_LABELS[mode]} — Zenith`;
    } else {
      document.title = "Focus Timer — Zenith";
    }
    return () => { document.title = "Zenith"; };
  }, [timeLeft, mode, running]);

  /* ── Fullscreen ── */
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mainRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  /* ── Document Picture-in-Picture: opens a floating window on user request ── */
  const openPip = useCallback(async () => {
    if (!("documentPictureInPicture" in window)) return;
    if (pipWindowRef.current) return;
    try {
      const pipWin: any = await (window as any).documentPictureInPicture.requestWindow({
        width: 280,
        height: 200,
      });

      pipWin.document.body.style.cssText =
        "margin:0;padding:0;background:linear-gradient(135deg,#14060c 0%,#1e0814 100%);" +
        "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
        "gap:10px;font-family:system-ui,sans-serif;height:100vh;overflow:hidden;";

      const modeEl = pipWin.document.createElement("div");
      modeEl.id = "pip-mode";
      modeEl.style.cssText =
        "color:#CB438B;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;";
      modeEl.textContent = MODE_LABELS[modeRef.current];
      pipWin.document.body.appendChild(modeEl);

      const timerEl = pipWin.document.createElement("div");
      timerEl.id = "pip-timer";
      timerEl.style.cssText =
        "color:#fff;font-size:56px;font-weight:700;font-variant-numeric:tabular-nums;" +
        "line-height:1;text-shadow:0 0 20px rgba(203,67,139,0.5);letter-spacing:-1px;";
      timerEl.textContent = fmt(timeLeft);
      pipWin.document.body.appendChild(timerEl);

      const btn = pipWin.document.createElement("button");
      btn.id = "pip-btn";
      btn.textContent = runningRef.current ? "⏸ Pause" : "▶ Resume";
      btn.style.cssText =
        "margin-top:4px;padding:8px 28px;border:none;border-radius:999px;" +
        "background:linear-gradient(135deg,#CB438B,#BF3556);color:#fff;" +
        "font-size:13px;font-weight:700;cursor:pointer;";
      btn.onclick = () => setRunning((r) => !r);
      pipWin.document.body.appendChild(btn);

      pipWindowRef.current = pipWin;
      setPipOpen(true);

      pipWin.addEventListener("pagehide", () => {
        pipWindowRef.current = null;
        setPipOpen(false);
      });
    } catch {
      // user denied or browser blocked — silently ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closePip = useCallback(() => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setPipOpen(false);
    }
  }, []);

  const togglePip = useCallback(() => {
    if (pipWindowRef.current) { closePip(); } else { openPip(); }
  }, [openPip, closePip]);

  /* ── Cleanup PiP on unmount ── */
  useEffect(() => () => { closePip(); }, [closePip]);

  /* ── Sync timeLeft + mode + running into the PiP window every tick ── */
  useEffect(() => {
    const win = pipWindowRef.current;
    if (!win) return;
    const timerEl = win.document.getElementById("pip-timer");
    const modeEl  = win.document.getElementById("pip-mode");
    const btn      = win.document.getElementById("pip-btn");
    if (timerEl) timerEl.textContent = fmt(timeLeft);
    if (modeEl)  modeEl.textContent  = MODE_LABELS[mode];
    if (btn)     btn.textContent     = running ? "⏸ Pause" : "▶ Resume";
  }, [timeLeft, mode, running]);

  /* ── Tasks (Supabase) ── */
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [mobileTab, setMobileTab] = useState<"tasks" | "settings">("tasks");

  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!token || cancelled) return;
      fetchTasks(token).then((t) => { if (!cancelled) setTasks(t); }).catch(() => {});
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Quick tasks (local only until saved) ── */
  const [quickTasks, setQuickTasks] = useState<QuickTask[]>([]);
  const [quickInput, setQuickInput] = useState("");
  const [saveModal, setSaveModal]   = useState<QuickTask | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  const addQuickTask = () => {
    const title = quickInput.trim();
    if (!title) return;
    setQuickTasks((prev) => [...prev, { id: Date.now().toString(), title, done: false }]);
    setQuickInput("");
  };
  const toggleQuickTask = (qt: QuickTask) =>
    setQuickTasks((prev) => prev.map((t) => t.id === qt.id ? { ...t, done: !t.done } : t));
  const removeQuickTask = (id: string) =>
    setQuickTasks((prev) => prev.filter((t) => t.id !== id));

  const saveQuickTask = async (qt: QuickTask) => {
    setSaveLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("no token");
      const created = await apiCreateTask(token, { title: qt.title, priority: "medium" });
      setTasks((prev) => [...prev, created]);
      removeQuickTask(qt.id);
      setSaveModal(null);
    } catch {
      // keep modal open on error
    } finally {
      setSaveLoading(false);
    }
  };

  /* ── handleComplete — uses refs, stable (zero deps) ── */
  const handleComplete = useCallback(() => {
    playDing();
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);

    const currentMode     = modeRef.current;
    const currentSessions = sessionsRef.current;
    const s               = settingsRef.current;

    if (currentMode === "focus") {
      const newSessions = currentSessions + 1;
      setSessions(newSessions);
      sessionsRef.current = newSessions;
      const next: Mode = newSessions % 4 === 0 ? "long" : "short";
      setMode(next);
      modeRef.current = next;
      setTimeLeft(secsForMode(next, s));
      if (s.autoStart) setTimeout(() => setRunning(true), 80);
    } else {
      const next: Mode = "focus";
      setMode(next);
      modeRef.current = next;
      setTimeLeft(secsForMode(next, s));
      if (s.autoStart) setTimeout(() => setRunning(true), 80);
    }
  }, []); // stable: reads everything from refs

  /* ── Tick ── */
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) { handleComplete(); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, handleComplete]);

  /* ── Mode switch resets timer ── */
  const switchMode = useCallback((m: Mode) => {
    setRunning(false);
    setMode(m);
    modeRef.current = m;
    setTimeLeft(secsForMode(m, settingsRef.current));
  }, []);

  /* ── Settings change resets current mode timer ── */
  const applySettings = useCallback((next: typeof DEFAULT_SETTINGS) => {
    setRunning(false);
    setSettings(next);
    settingsRef.current = next;
    setTimeLeft(secsForMode(modeRef.current, next));
  }, []);

  /* ── Toggle Supabase task ── */
  const handleToggle = useCallback(async (task: Task) => {
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: !t.done } : t));
    try {
      const token = await getToken();
      if (!token) throw new Error("no token");
      const updated = await apiPatchTask(token, task.id, { done: !task.done });
      setTasks((prev) => prev.map((t) => t.id === task.id ? updated : t));
    } catch {
      setTasks((prev) => prev.map((t) => t.id === task.id ? task : t));
    }
  }, [getToken]);

  /* ── Progress ring ── */
  const total        = secsForMode(mode, settings);
  const progress     = total > 0 ? (total - timeLeft) / total : 0;
  const circumference = 2 * Math.PI * 110;
  const strokeDash   = circumference * progress;

  const overlay = dark ? "rgba(10,2,8,0.72)" : "rgba(255,240,220,0.62)";
  const activeTasks = sortTasks(tasks).filter((t) => !t.done);

  const glassNav: React.CSSProperties = {
    background: dark ? "rgba(20,6,12,0.80)" : "rgba(255,246,234,0.80)",
    borderColor: "rgba(203,67,139,0.30)",
    transition: "background 0.4s ease",
  };

  return (
    <main ref={mainRef} className="relative min-h-screen overflow-x-hidden flex flex-col">

      {/* ── Full-page background ── */}
      <div className="fixed inset-0 z-0">
        <img key={bgIdx} src={BACKGROUNDS[bgIdx].src} alt=""
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700" />
        <div className="absolute inset-0" style={{ background: overlay }} />
      </div>

      {/* ── Floating stickers ── */}
      {FLOATERS.map((f, i) => (
        <span key={i} aria-hidden className={`pointer-events-none fixed ${f.anim}`}
          style={{ top: (f as any).top, bottom: (f as any).bottom, left: (f as any).left, right: (f as any).right, animationDelay: f.delay, opacity: 0.65, zIndex: 2 }}>
          <Image src={f.src} alt="" width={f.w} height={f.w} className="object-contain" />
        </span>
      ))}

      {/* ── Nav ── */}
      <div className="relative z-50 px-4 pt-3 sm:px-6">
        <header className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border px-5 py-3 shadow-xl backdrop-blur-2xl" style={glassNav}>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 text-sm font-bold transition-all hover:scale-105 text-fg-primary">
              <Image src={dark ? "/images/1.png" : "/images/5.png"} alt="" width={24} height={24} className="object-contain" />
              ← Dashboard
            </Link>
          </div>
          <span className="font-display text-base font-bold italic text-fg-primary">Focus Timer</span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Go fullscreen"}
              className="flex h-8 w-8 items-center justify-center rounded-xl border text-sm font-bold text-fg-secondary transition-all hover:scale-110"
              style={{ border: "1.5px solid rgba(203,67,139,0.30)", background: dark ? "rgba(203,67,139,0.08)" : "rgba(255,240,220,0.60)", backdropFilter: "blur(10px)" }}>
              {isFullscreen ? "⊡" : "⛶"}
            </button>
            {pipSupported ? (
              <button
                onClick={togglePip}
                title={pipOpen ? "Close mini player" : "Pop out mini player"}
                className="flex h-8 w-8 items-center justify-center rounded-xl border text-sm font-bold text-fg-secondary transition-all hover:scale-110"
                style={{ border: `1.5px solid ${pipOpen ? "rgba(203,67,139,0.50)" : "rgba(203,67,139,0.30)"}`, background: pipOpen ? (dark ? "rgba(203,67,139,0.20)" : "rgba(203,67,139,0.12)") : (dark ? "rgba(203,67,139,0.08)" : "rgba(255,240,220,0.60)"), backdropFilter: "blur(10px)" }}>
                ⧉
              </button>
            ) : (
              <button
                onClick={() => setPipOpen((p) => !p)}
                title={pipOpen ? "Close mini player" : "Pop out mini player"}
                className="flex h-8 w-8 items-center justify-center rounded-xl border text-sm font-bold text-fg-secondary transition-all hover:scale-110"
                style={{ border: `1.5px solid ${pipOpen ? "rgba(203,67,139,0.50)" : "rgba(203,67,139,0.30)"}`, background: pipOpen ? (dark ? "rgba(203,67,139,0.20)" : "rgba(203,67,139,0.12)") : (dark ? "rgba(203,67,139,0.08)" : "rgba(255,240,220,0.60)"), backdropFilter: "blur(10px)" }}>
                ⧉
              </button>
            )}
            <ThemeToggle />
          </div>
        </header>
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-start px-4 pb-32 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">

          {/* ── Mode tabs ── */}
          <div className="mb-6 flex justify-center gap-2">
            {(["focus", "short", "long"] as Mode[]).map((m) => (
              <button key={m} onClick={() => switchMode(m)}
                className="rounded-2xl px-4 py-2 text-sm font-bold transition-all hover:scale-105"
                style={{
                  background: mode === m ? "linear-gradient(135deg,#CB438B,#BF3556)" : (dark ? "rgba(203,67,139,0.12)" : "rgba(255,240,220,0.60)"),
                  color: mode === m ? "#fff" : "var(--fg-primary)",
                  border: `1.5px solid ${mode === m ? "transparent" : "rgba(203,67,139,0.25)"}`,
                  backdropFilter: "blur(10px)",
                }}>
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[280px_1fr_280px]">

            {/* ── Left panel: Tasks + Quick Tasks ── */}
            <aside className="hidden lg:block">
              <TasksPanel
                tasks={activeTasks} dark={dark} onToggle={handleToggle}
                quickTasks={quickTasks} quickInput={quickInput}
                onQuickInput={setQuickInput} onAddQuick={addQuickTask}
                onToggleQuick={toggleQuickTask} onRemoveQuick={removeQuickTask}
                onSaveQuick={(qt) => setSaveModal(qt)}
              />
            </aside>

            {/* ── Center: Timer ── */}
            <div className="flex flex-col items-center gap-6">
              {/* Ring */}
              <div className="relative flex items-center justify-center">
                <svg width={260} height={260} className="drop-shadow-2xl -rotate-90">
                  <circle cx={130} cy={130} r={110} fill="none"
                    stroke={dark ? "rgba(203,67,139,0.15)" : "rgba(203,67,139,0.12)"} strokeWidth={10} />
                  <circle cx={130} cy={130} r={110} fill="none"
                    stroke="url(#ring-grad)" strokeWidth={10} strokeLinecap="round"
                    strokeDasharray={`${strokeDash} ${circumference}`}
                    style={{ transition: running ? "stroke-dasharray 1s linear" : "none" }} />
                  <defs>
                    <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#CB438B" />
                      <stop offset="100%" stopColor="#BF3556" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-display text-6xl font-bold tabular-nums"
                    style={{ color: "var(--fg-primary)", textShadow: "0 2px 20px rgba(203,67,139,0.4)" }}>
                    {fmt(timeLeft)}
                  </span>
                  <span className="mt-1 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#CB438B" }}>
                    {MODE_LABELS[mode]}
                  </span>
                </div>
              </div>

              {/* Session dots */}
              <div className="flex items-center gap-2">
                {Array.from({ length: 4 }).map((_, i) => {
                  const filled  = (sessions % 4) > i;
                  const current = !filled && mode === "focus" && (sessions % 4) === i;
                  return (
                    <div key={i} className="h-2.5 w-2.5 rounded-full transition-all duration-300"
                      style={{
                        background: filled ? "linear-gradient(135deg,#CB438B,#BF3556)" : (current ? "#CB438B" : (dark ? "rgba(203,67,139,0.22)" : "rgba(203,67,139,0.18)")),
                        boxShadow: filled ? "0 0 8px rgba(203,67,139,0.5)" : "none",
                        transform: current ? "scale(1.3)" : "scale(1)",
                      }} />
                  );
                })}
                <span className="ml-1 text-xs text-fg-secondary">{sessions} done</span>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4">
                <button onClick={() => { setRunning(false); setTimeLeft(secsForMode(mode, settings)); }}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border font-bold text-fg-secondary transition-all hover:scale-110"
                  style={{ border: "1.5px solid rgba(203,67,139,0.30)", background: dark ? "rgba(203,67,139,0.08)" : "rgba(255,240,220,0.60)", backdropFilter: "blur(10px)" }}
                  title="Reset">
                  ↺
                </button>

                <button onClick={() => setRunning((r) => !r)}
                  className="flex h-20 w-20 items-center justify-center rounded-full font-bold text-white shadow-2xl transition-all hover:scale-110 active:scale-95 animate-pulse-glow"
                  style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)", fontSize: "2rem" }}>
                  {running ? "⏸" : "▶"}
                </button>

                <button
                  onClick={() => setShowSettings((s) => !s)}
                  title={showSettings ? "Hide settings" : "Show settings"}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border font-bold text-fg-secondary transition-all hover:scale-110"
                  style={{
                    border: `1.5px solid ${showSettings ? "rgba(203,67,139,0.50)" : "rgba(203,67,139,0.30)"}`,
                    background: showSettings ? (dark ? "rgba(203,67,139,0.20)" : "rgba(203,67,139,0.12)") : (dark ? "rgba(203,67,139,0.08)" : "rgba(255,240,220,0.60)"),
                    backdropFilter: "blur(10px)",
                  }}>
                  ⚙
                </button>
              </div>

              {/* Mobile tab switcher */}
              <div className="flex w-full gap-2 lg:hidden">
                {(["tasks", "settings"] as const).map((t) => (
                  <button key={t} onClick={() => setMobileTab(t)}
                    className="flex-1 rounded-2xl py-2 text-sm font-bold transition-all"
                    style={{
                      background: mobileTab === t ? "linear-gradient(135deg,#CB438B,#BF3556)" : (dark ? "rgba(203,67,139,0.10)" : "rgba(255,240,220,0.60)"),
                      color: mobileTab === t ? "#fff" : "var(--fg-secondary)",
                      border: "1.5px solid rgba(203,67,139,0.25)",
                      backdropFilter: "blur(10px)",
                    }}>
                    {t === "tasks" ? "Tasks" : "Settings"}
                  </button>
                ))}
              </div>

              {/* Mobile panels */}
              <div className="w-full lg:hidden">
                {mobileTab === "tasks"
                  ? <TasksPanel
                      tasks={activeTasks} dark={dark} onToggle={handleToggle}
                      quickTasks={quickTasks} quickInput={quickInput}
                      onQuickInput={setQuickInput} onAddQuick={addQuickTask}
                      onToggleQuick={toggleQuickTask} onRemoveQuick={removeQuickTask}
                      onSaveQuick={(qt) => setSaveModal(qt)}
                    />
                  : <SettingsPanel settings={settings} onApply={applySettings} dark={dark} />}
              </div>
            </div>

            {/* ── Right panel: Settings (toggled by ⚙) ── */}
            <aside className={`hidden lg:block transition-all duration-300 ${showSettings ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}>
              <SettingsPanel settings={settings} onApply={applySettings} dark={dark} />
            </aside>
          </div>
        </div>
      </div>

      {/* ── Background picker ── */}
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-2xl border px-4 py-2.5 shadow-2xl backdrop-blur-2xl"
          style={{ background: dark ? "rgba(20,6,12,0.85)" : "rgba(255,246,234,0.90)", borderColor: "rgba(203,67,139,0.25)" }}>
          <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#CB438B", opacity: 0.8 }}>bg</span>
          {BACKGROUNDS.map((bg, i) => (
            <button key={i} onClick={() => setBgIdx(i)} title={bg.label}
              className="relative overflow-hidden rounded-xl transition-all hover:scale-110"
              style={{ width: 36, height: 36, outline: i === bgIdx ? "2.5px solid #CB438B" : "2.5px solid transparent", outlineOffset: 2 }}>
              <img src={bg.src} alt={bg.label} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Fallback pill: shown on browsers without documentPictureInPicture when user enables mini player ── */}
      {pipOpen && !pipSupported && (
        <div
          className="fixed z-[9999] flex flex-col items-center gap-2 rounded-2xl border px-5 py-3.5 shadow-2xl backdrop-blur-2xl"
          style={{ bottom: 96, right: 24, background: dark ? "rgba(18,4,10,0.94)" : "rgba(255,246,234,0.96)", borderColor: "rgba(203,67,139,0.50)", minWidth: 140 }}
        >
          <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "#CB438B" }}>
            {MODE_LABELS[mode]}
          </span>
          <span className="font-display text-4xl font-bold tabular-nums" style={{ color: "var(--fg-primary)", textShadow: "0 0 12px rgba(203,67,139,0.35)" }}>
            {fmt(timeLeft)}
          </span>
          <button
            onClick={() => setRunning((r) => !r)}
            className="rounded-xl px-4 py-1.5 text-xs font-bold text-white shadow transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
            {running ? "⏸ Pause" : "▶ Resume"}
          </button>
        </div>
      )}

      {/* ── Save quick task modal ── */}
      {saveModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setSaveModal(null); }}>
          <div className="relative rounded-3xl border p-7 shadow-2xl w-[340px]"
            style={{ background: dark ? "rgba(20,6,12,0.96)" : "rgba(255,246,234,0.97)", borderColor: "rgba(203,67,139,0.35)", backdropFilter: "blur(20px)" }}>
            <p className="mb-1 text-sm font-bold text-fg-primary">Save to your task list?</p>
            <p className="mb-4 text-xs text-fg-secondary">This will permanently add the task to Supabase.</p>
            <div className="mb-5 rounded-xl px-3 py-2.5 text-sm font-semibold"
              style={{ background: dark ? "rgba(203,67,139,0.10)" : "rgba(203,67,139,0.07)", color: "var(--fg-primary)" }}>
              {saveModal.title}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSaveModal(null)}
                className="flex-1 rounded-2xl py-2 text-sm font-bold text-fg-secondary border transition-all hover:scale-105"
                style={{ borderColor: "rgba(203,67,139,0.25)", background: "transparent" }}>
                Cancel
              </button>
              <button onClick={() => saveQuickTask(saveModal)} disabled={saveLoading}
                className="flex-1 rounded-2xl py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
                {saveLoading ? "Saving…" : "Save Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────
   Tasks side panel
───────────────────────────────────────────────────────────── */
interface TasksPanelProps {
  tasks: Task[];
  dark: boolean;
  onToggle: (t: Task) => void;
  quickTasks: QuickTask[];
  quickInput: string;
  onQuickInput: (v: string) => void;
  onAddQuick: () => void;
  onToggleQuick: (qt: QuickTask) => void;
  onRemoveQuick: (id: string) => void;
  onSaveQuick: (qt: QuickTask) => void;
}

function TasksPanel({
  tasks, dark, onToggle,
  quickTasks, quickInput, onQuickInput, onAddQuick, onToggleQuick, onRemoveQuick, onSaveQuick,
}: TasksPanelProps) {
  const glass: React.CSSProperties = {
    background: dark ? "rgba(20,6,12,0.78)" : "rgba(255,246,234,0.82)",
    borderColor: "rgba(203,67,139,0.22)",
    backdropFilter: "blur(18px)",
  };

  return (
    <div className="rounded-3xl border p-5 shadow-2xl space-y-5" style={glass}>

      {/* ── Supabase tasks ── */}
      <div>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "#CB438B" }}>
          Active Tasks
        </p>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 opacity-60">
            <Image src="/images/9.png" alt="" width={40} height={40} className="object-contain animate-float-slow" />
            <p className="text-center text-xs italic text-fg-secondary">All clear — nothing pending!</p>
          </div>
        ) : (
          <ul className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
            {tasks.map((task) => {
              const m = PRIORITY_META[task.priority];
              return (
                <li key={task.id}
                  className="flex items-center gap-2.5 rounded-xl p-2.5 transition-all hover:scale-[1.02]"
                  style={{ background: dark ? "rgba(203,67,139,0.07)" : "rgba(203,67,139,0.05)", border: "1px solid rgba(203,67,139,0.12)" }}>
                  <button onClick={() => onToggle(task)} aria-label="Toggle"
                    className="shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110"
                    style={{ borderColor: "#CB438B", background: "transparent" }} />
                  <span className="flex-1 truncate text-xs font-semibold text-fg-primary">{task.title}</span>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold"
                    style={{ background: dark ? m.darkBg : m.bg, color: m.color }}>
                    {m.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/tasks"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold transition-all hover:scale-105"
          style={{ color: "#CB438B" }}>
          Manage all tasks →
        </Link>
      </div>

      {/* ── Quick tasks ── */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "#CB438B" }}>
          Quick Tasks
          <span className="ml-1 font-normal normal-case opacity-60">(local)</span>
        </p>

        {/* Input row */}
        <div className="flex gap-2 mb-3">
          <input
            value={quickInput}
            onChange={(e) => onQuickInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onAddQuick(); }}
            placeholder="Add a quick task…"
            className="flex-1 min-w-0 rounded-xl px-3 py-2 text-xs font-medium border outline-none focus:ring-2 focus:ring-[rgba(203,67,139,0.35)]"
            style={{
              background: dark ? "rgba(203,67,139,0.10)" : "rgba(255,255,255,0.70)",
              borderColor: "rgba(203,67,139,0.25)",
              color: "var(--fg-primary)",
            }}
          />
          <button onClick={onAddQuick}
            className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
            +
          </button>
        </div>

        {/* Quick list */}
        {quickTasks.length > 0 && (
          <ul className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
            {quickTasks.map((qt) => (
              <li key={qt.id}
                className="flex items-center gap-2 rounded-xl p-2 transition-all"
                style={{ background: dark ? "rgba(203,67,139,0.06)" : "rgba(203,67,139,0.04)", border: "1px solid rgba(203,67,139,0.10)" }}>
                <button onClick={() => onToggleQuick(qt)}
                  className="shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all"
                  style={{ borderColor: qt.done ? "#CB438B" : "rgba(203,67,139,0.40)", background: qt.done ? "#CB438B" : "transparent" }}>
                  {qt.done && <span className="text-white text-[8px] leading-none">✓</span>}
                </button>
                <span className={`flex-1 truncate text-xs font-medium ${qt.done ? "line-through opacity-50" : ""}`}
                  style={{ color: "var(--fg-primary)" }}>
                  {qt.title}
                </span>
                <button onClick={() => onSaveQuick(qt)} title="Save to task list"
                  className="shrink-0 text-[11px] font-bold transition-all hover:scale-110 opacity-60 hover:opacity-100"
                  style={{ color: "#CB438B" }}>
                  ↑
                </button>
                <button onClick={() => onRemoveQuick(qt.id)} title="Remove"
                  className="shrink-0 text-[10px] transition-all hover:scale-110 opacity-40 hover:opacity-70 text-fg-secondary">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Settings panel
───────────────────────────────────────────────────────────── */
type SettingsState = typeof DEFAULT_SETTINGS;

function SettingsPanel({ settings, onApply, dark }: { settings: SettingsState; onApply: (s: SettingsState) => void; dark: boolean }) {
  const [local, setLocal] = useState(settings);

  // Sync when settings prop changes externally
  useEffect(() => { setLocal(settings); }, [settings]);

  const glass: React.CSSProperties = {
    background: dark ? "rgba(20,6,12,0.78)" : "rgba(255,246,234,0.82)",
    borderColor: "rgba(203,67,139,0.22)",
    backdropFilter: "blur(18px)",
  };

  function SliderRow({ label, k, min, max }: { label: string; k: keyof Omit<SettingsState, "autoStart">; min: number; max: number }) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-fg-secondary">{label}</label>
          <span className="text-xs font-bold" style={{ color: "#CB438B" }}>{local[k]} min</span>
        </div>
        <input type="range" min={min} max={max} value={local[k]}
          onChange={(e) => setLocal((s) => ({ ...s, [k]: Number(e.target.value) }))}
          className="w-full cursor-pointer" style={{ accentColor: "#CB438B" }} />
        <div className="flex justify-between text-[10px] text-fg-secondary opacity-60">
          <span>{min}m</span><span>{max}m</span>
        </div>
      </div>
    );
  }

  const presets = [
    { label: "25 / 5",  focus: 25, short: 5,  long: 15 },
    { label: "50 / 10", focus: 50, short: 10, long: 20 },
    { label: "60 / 15", focus: 60, short: 15, long: 30 },
  ];

  return (
    <div className="rounded-3xl border p-5 shadow-2xl" style={glass}>
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "#CB438B" }}>
        Settings
      </p>

      {/* Presets */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold text-fg-secondary">Quick Presets</p>
        <div className="flex gap-2">
          {presets.map((p) => (
            <button key={p.label}
              onClick={() => { const next = { ...local, focus: p.focus, short: p.short, long: p.long }; setLocal(next); onApply(next); }}
              className="flex-1 rounded-xl py-2 text-xs font-bold transition-all hover:scale-105"
              style={{
                background: local.focus === p.focus ? "linear-gradient(135deg,#CB438B,#BF3556)" : (dark ? "rgba(203,67,139,0.10)" : "rgba(203,67,139,0.06)"),
                color: local.focus === p.focus ? "#fff" : "var(--fg-secondary)",
                border: "1.5px solid rgba(203,67,139,0.20)",
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <SliderRow label="Focus Duration" k="focus" min={5}  max={90} />
        <SliderRow label="Short Break"    k="short" min={1}  max={20} />
        <SliderRow label="Long Break"     k="long"  min={5}  max={30} />
      </div>

      {/* Auto-start toggle — applies immediately */}
      <div className="mt-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-fg-primary">Auto-start next</p>
          <p className="text-[10px] text-fg-secondary">Start breaks/sessions automatically</p>
        </div>
        <button
          onClick={() => { const next = { ...local, autoStart: !local.autoStart }; setLocal(next); onApply(next); }}
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 overflow-hidden"
          style={{ background: local.autoStart ? "linear-gradient(135deg,#CB438B,#BF3556)" : (dark ? "rgba(203,67,139,0.20)" : "rgba(203,67,139,0.15)") }}>
          <span className="absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition-all duration-300"
            style={{ left: local.autoStart ? "22px" : "2px" }} />
        </button>
      </div>

      {/* Apply button */}
      <button onClick={() => onApply(local)}
        className="mt-5 w-full rounded-2xl py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-105"
        style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
        Apply Settings
      </button>
    </div>
  );
}
