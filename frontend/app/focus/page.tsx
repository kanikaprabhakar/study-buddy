"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { useTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fetchTasks, apiPatchTask, apiCreateTask, apiLogSession, sortTasks, PRIORITY_META, type Task } from "@/lib/tasks";

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
const STUDY_DAYS_KEY = "zenith_study_days";
const FIRST_SESSION_KEY = "zenith_first_session_toast";
const FIRST_SESSION_START_KEY = "zenith_first_session_start";

/** Local-timezone YYYY-MM-DD — avoids UTC offset shifting the date */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Mark today as a study day in localStorage */
function markStudyDay() {
  try {
    const today = todayISO();
    const raw = localStorage.getItem(STUDY_DAYS_KEY);
    const days: string[] = raw ? JSON.parse(raw) : [];
    if (!days.includes(today)) {
      days.push(today);
      // only keep last 30 days
      const trimmed = days.slice(-30);
      localStorage.setItem(STUDY_DAYS_KEY, JSON.stringify(trimmed));
    }
  } catch {}
}

/** Returns true if this is the first focus session completed today */
function isFirstSessionToday(): boolean {
  try {
    const today = todayISO();
    const last = localStorage.getItem(FIRST_SESSION_KEY);
    if (last === today) return false;
    localStorage.setItem(FIRST_SESSION_KEY, today);
    return true;
  } catch { return false; }
}

/** Returns true if this is the first time a session is STARTED today */
function isFirstSessionStartToday(): boolean {
  try {
    const today = todayISO();
    const last = localStorage.getItem(FIRST_SESSION_START_KEY);
    if (last === today) return false;
    localStorage.setItem(FIRST_SESSION_START_KEY, today);
    return true;
  } catch { return false; }
}

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
        width: 300,
        height: 240,
      });

      // Base styles
      // Inject Playfair Display so PiP timer matches the main focus page font
      pipWin.document.head.innerHTML =
        '<link rel="preconnect" href="https://fonts.googleapis.com">' +
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
        '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">';
      pipWin.document.body.style.cssText =
        "margin:0;padding:0;overflow:hidden;font-family:'Playfair Display',Georgia,serif;";

      // Full layout
      pipWin.document.body.innerHTML = `
        <style>
          * { box-sizing: border-box; }
          body { background: #0e0410; }
          .pip-wrap {
            width: 100vw; height: 100vh;
            background: linear-gradient(145deg, #130610 0%, #1e0a16 50%, #120310 100%);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 0; position: relative; overflow: hidden;
          }
          .pip-glow {
            position: absolute; width: 220px; height: 220px;
            background: radial-gradient(circle, rgba(203,67,139,0.18) 0%, transparent 70%);
            border-radius: 50%; top: 50%; left: 50%;
            transform: translate(-50%, -50%); pointer-events: none;
          }
          .pip-mode {
            color: #CB438B; font-size: 9px; font-weight: 800;
            text-transform: uppercase; letter-spacing: 0.25em;
            margin-bottom: 4px; position: relative; z-index: 1;
          }
          .pip-ring-wrap {
            position: relative; width: 130px; height: 130px;
            display: flex; align-items: center; justify-content: center;
          }
          .pip-ring-wrap svg { position: absolute; inset: 0; transform: rotate(-90deg); }
          .pip-center {
            position: relative; z-index: 1;
            display: flex; flex-direction: column; align-items: center; gap: 0;
          }
          .pip-timer {
            color: #fff; font-size: 44px; font-weight: 800;
            font-family: 'Playfair Display', Georgia, serif;
            font-variant-numeric: tabular-nums; line-height: 1;
            letter-spacing: -2px;
            text-shadow: 0 0 30px rgba(203,67,139,0.6);
          }
          .pip-controls {
            display: flex; gap: 10px; align-items: center;
            margin-top: 12px; position: relative; z-index: 1;
          }
          .pip-btn-main {
            width: 52px; height: 52px; border-radius: 50%; border: none; cursor: pointer;
            background: linear-gradient(135deg, #CB438B, #BF3556);
            color: #fff; font-size: 20px; display: flex;
            align-items: center; justify-content: center;
            box-shadow: 0 0 20px rgba(203,67,139,0.5);
            transition: transform 0.15s; outline: none;
          }
          .pip-btn-main:hover { transform: scale(1.1); }
          .pip-btn-main:active { transform: scale(0.95); }
          .pip-label {
            color: rgba(255,229,208,0.55); font-size: 9px; font-weight: 600;
            text-transform: uppercase; letter-spacing: 0.15em;
            margin-top: 10px; position: relative; z-index: 1;
          }
          .pip-top-bar {
            position: absolute; top: 0; left: 0; right: 0; height: 3px;
            background: linear-gradient(90deg, #CB438B, #BF3556);
          }
        </style>
        <div class="pip-wrap">
          <div class="pip-top-bar"></div>
          <div class="pip-glow"></div>
          <div class="pip-mode" id="pip-mode">Focus</div>
          <div class="pip-ring-wrap">
            <svg width="130" height="130" viewBox="0 0 130 130" id="pip-svg">
              <circle cx="65" cy="65" r="55" fill="none" stroke="rgba(203,67,139,0.18)" stroke-width="7"/>
              <circle cx="65" cy="65" r="55" fill="none" stroke="url(#pg)" stroke-width="7"
                stroke-linecap="round" id="pip-arc"
                stroke-dasharray="345.4 345.4" stroke-dashoffset="0"/>
              <defs>
                <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#CB438B"/>
                  <stop offset="100%" stop-color="#BF3556"/>
                </linearGradient>
              </defs>
            </svg>
            <div class="pip-center">
              <div class="pip-timer" id="pip-timer">25:00</div>
            </div>
          </div>
          <div class="pip-controls">
            <button class="pip-btn-main" id="pip-btn">▶</button>
          </div>
          <div class="pip-label" id="pip-sessions">0 sessions done</div>
        </div>
      `;

      const timerEl    = pipWin.document.getElementById("pip-timer")!;
      const modeEl     = pipWin.document.getElementById("pip-mode")!;
      const btn        = pipWin.document.getElementById("pip-btn")!;
      const arcEl      = pipWin.document.getElementById("pip-arc")!;
      const sessionsEl = pipWin.document.getElementById("pip-sessions")!;

      btn.onclick = () => setRunning((r) => !r);

      // Initial sync
      const CIRC = 2 * Math.PI * 55;
      const syncPip = (tl: number, md: Mode, run: boolean, sess: number, sett: typeof DEFAULT_SETTINGS) => {
        const total = secsForMode(md, sett);
        const prog  = total > 0 ? (total - tl) / total : 0;
        timerEl.textContent    = fmt(tl);
        modeEl.textContent     = MODE_LABELS[md];
        btn.textContent        = run ? "⏸" : "▶";
        arcEl.setAttribute("stroke-dasharray", `${CIRC * prog} ${CIRC}`);
        sessionsEl.textContent = `${sess} session${sess !== 1 ? "s" : ""} done`;
      };
      syncPip(timeLeft, modeRef.current, runningRef.current, sessionsRef.current, settingsRef.current);
      (pipWin as any).__syncPip = syncPip;

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

  /* ── First session START notification (fires when timer goes from paused → running in focus mode) ── */
  useEffect(() => {
    if (!prevRunningRef.current && running && modeRef.current === "focus") {
      if (isFirstSessionStartToday()) {
        setStartSessionToast(true);
        setTimeout(() => setStartSessionToast(false), 5000);
      }
    }
    prevRunningRef.current = running;
  }, [running]);

  /* ── Sync timeLeft + mode + running into the PiP window every tick ── */
  useEffect(() => {
    const win = pipWindowRef.current;
    if (!win || !win.__syncPip) return;
    win.__syncPip(timeLeft, mode, running, sessions, settings);
  }, [timeLeft, mode, running, sessions, settings]);

  /* ── Tasks (Supabase) ── */
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [mobileTab, setMobileTab] = useState<"tasks" | "settings">("tasks");
  const [firstSessionToast, setFirstSessionToast] = useState(false);
  const [startSessionToast, setStartSessionToast] = useState(false);
  const prevRunningRef = useRef(false);

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
      // Log session to backend + mark study day in localStorage
      markStudyDay();
      if (isFirstSessionToday()) {
        setFirstSessionToast(true);
        setTimeout(() => setFirstSessionToast(false), 6000);
      }
      getToken().then((token) => {
        if (token) apiLogSession(token, { duration_min: s.focus, mode: "focus", studied_on: todayISO() }).catch(() => {});
      });

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
  }, [getToken]); // stable: reads everything from refs

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
              className="flex h-8 w-8 items-center justify-center rounded-xl border text-sm font-bold text-fg-secondary transition-all hover:scale-110 cursor-pointer"
              style={{ border: "1.5px solid rgba(203,67,139,0.30)", background: dark ? "rgba(203,67,139,0.08)" : "rgba(255,240,220,0.60)", backdropFilter: "blur(10px)" }}>
              {isFullscreen ? "⊡" : "⛶"}
            </button>
            <button
              onClick={pipSupported ? togglePip : () => setPipOpen((p) => !p)}
              title={pipOpen ? "Close mini player" : "Pop out mini player"}
              className="flex h-8 w-8 items-center justify-center rounded-xl border text-sm font-bold text-fg-secondary transition-all hover:scale-110 cursor-pointer"
              style={{ border: `1.5px solid ${pipOpen ? "rgba(203,67,139,0.50)" : "rgba(203,67,139,0.30)"}`, background: pipOpen ? (dark ? "rgba(203,67,139,0.20)" : "rgba(203,67,139,0.12)") : (dark ? "rgba(203,67,139,0.08)" : "rgba(255,240,220,0.60)"), backdropFilter: "blur(10px)" }}>
              ⧉
            </button>
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
                className="rounded-2xl px-4 py-2 text-sm font-bold transition-all hover:scale-105 cursor-pointer"
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
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border font-bold text-fg-secondary transition-all hover:scale-110 cursor-pointer"
                  style={{ border: "1.5px solid rgba(203,67,139,0.30)", background: dark ? "rgba(203,67,139,0.08)" : "rgba(255,240,220,0.60)", backdropFilter: "blur(10px)" }}
                  title="Reset">
                  ↺
                </button>

                <button onClick={() => setRunning((r) => !r)}
                  className="flex h-20 w-20 items-center justify-center rounded-full font-bold text-white shadow-2xl transition-all hover:scale-110 active:scale-95 animate-pulse-glow cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)", fontSize: "2rem" }}>
                  {running ? "⏸" : "▶"}
                </button>

                <button
                  onClick={() => setShowSettings((s) => !s)}
                  title={showSettings ? "Hide settings" : "Show settings"}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border font-bold text-fg-secondary transition-all hover:scale-110 cursor-pointer"
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
                    className="flex-1 rounded-2xl py-2 text-sm font-bold transition-all cursor-pointer"
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
              className="relative overflow-hidden rounded-xl transition-all hover:scale-110 cursor-pointer"
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
            className="rounded-xl px-4 py-1.5 text-xs font-bold text-white shadow transition-all hover:scale-105 cursor-pointer"
            style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
            {running ? "⏸ Pause" : "▶ Resume"}
          </button>
        </div>
      )}

      {/* ── First session START toast ── */}
      {startSessionToast && (
        <div
          className="fixed z-[10002] flex items-start gap-4 rounded-3xl border px-6 py-5 shadow-2xl backdrop-blur-2xl"
          style={{
            top: 24, left: "50%", transform: "translateX(-50%)",
            background: "linear-gradient(135deg, rgba(20,6,12,0.97) 0%, rgba(30,8,18,0.97) 100%)",
            borderColor: "rgba(203,67,139,0.50)",
            minWidth: 300, maxWidth: 380,
            animation: "slideDown 0.4s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <span style={{ fontSize: 32, lineHeight: 1 }}>🔥</span>
          <div>
            <p className="font-display text-base font-bold italic" style={{ color: "#FFE5D0" }}>
              Let&apos;s goooo!
            </p>
            <p className="mt-0.5 text-sm leading-snug" style={{ color: "#C9A595" }}>
              First session of the day — you showed up. Now stay locked in! 💪
            </p>
          </div>
          <button
            onClick={() => setStartSessionToast(false)}
            className="ml-auto shrink-0 text-xs font-bold transition-opacity hover:opacity-70 cursor-pointer"
            style={{ color: "#CB438B" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── First session END toast ── */}
      {firstSessionToast && (
        <div
          className="fixed z-[10001] flex items-start gap-4 rounded-3xl border px-6 py-5 shadow-2xl backdrop-blur-2xl"
          style={{
            top: 24, left: "50%", transform: "translateX(-50%)",
            background: "linear-gradient(135deg, rgba(20,6,12,0.97) 0%, rgba(30,8,18,0.97) 100%)",
            borderColor: "rgba(203,67,139,0.50)",
            minWidth: 300, maxWidth: 380,
            animation: "slideDown 0.4s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <span style={{ fontSize: 32, lineHeight: 1 }}>🌸</span>
          <div>
            <p className="font-display text-base font-bold italic" style={{ color: "#FFE5D0" }}>
              First session done!
            </p>
            <p className="mt-0.5 text-sm leading-snug" style={{ color: "#C9A595" }}>
              You showed up today — that&apos;s the hardest part. Keep crushing it! 💪
            </p>
          </div>
          <button
            onClick={() => setFirstSessionToast(false)}
            className="ml-auto shrink-0 text-xs font-bold transition-opacity hover:opacity-70 cursor-pointer"
            style={{ color: "#CB438B" }}
          >
            ✕
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
                className="flex-1 rounded-2xl py-2 text-sm font-bold text-fg-secondary border transition-all hover:scale-105 cursor-pointer"
                style={{ borderColor: "rgba(203,67,139,0.25)", background: "transparent" }}>
                Cancel
              </button>
              <button onClick={() => saveQuickTask(saveModal)} disabled={saveLoading}
                className="flex-1 rounded-2xl py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 disabled:opacity-60 cursor-pointer"
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
                    className="shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
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
            className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all hover:scale-105 cursor-pointer"
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
                  className="shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer"
                  style={{ borderColor: qt.done ? "#CB438B" : "rgba(203,67,139,0.40)", background: qt.done ? "#CB438B" : "transparent" }}>
                  {qt.done && <span className="text-white text-[8px] leading-none">✓</span>}
                </button>
                <span className={`flex-1 truncate text-xs font-medium ${qt.done ? "line-through opacity-50" : ""}`}
                  style={{ color: "var(--fg-primary)" }}>
                  {qt.title}
                </span>
                <button onClick={() => onSaveQuick(qt)} title="Save to task list"
                  className="shrink-0 text-[11px] font-bold transition-all hover:scale-110 opacity-60 hover:opacity-100 cursor-pointer"
                  style={{ color: "#CB438B" }}>
                  ↑
                </button>
                <button onClick={() => onRemoveQuick(qt.id)} title="Remove"
                  className="shrink-0 text-[10px] transition-all hover:scale-110 opacity-40 hover:opacity-70 text-fg-secondary cursor-pointer">
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
              className="flex-1 rounded-xl py-2 text-xs font-bold transition-all hover:scale-105 cursor-pointer"
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
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 overflow-hidden cursor-pointer"
          style={{ background: local.autoStart ? "linear-gradient(135deg,#CB438B,#BF3556)" : (dark ? "rgba(203,67,139,0.20)" : "rgba(203,67,139,0.15)") }}>
          <span className="absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition-all duration-300"
            style={{ left: local.autoStart ? "22px" : "2px" }} />
        </button>
      </div>

      {/* Apply button */}
      <button onClick={() => onApply(local)}
        className="mt-5 w-full rounded-2xl py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 cursor-pointer"
        style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
        Apply Settings
      </button>
    </div>
  );
}
