"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiGeneratePlan, apiConfirmPlan, type Task, type PreviewTask, type PlanIntensity } from "@/lib/tasks";

/* ── helpers ── */
function getMondayISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun…6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/* ── types ── */
interface Props {
  dark: boolean;
  onClose: () => void;
  onGenerated: (tasks: Task[]) => void;
}

const INTENSITIES: { value: PlanIntensity; label: string; sub: string }[] = [
  { value: "light",    label: "Light",    sub: "2 topics, easy exercises, gentle revision" },
  { value: "moderate", label: "Moderate", sub: "2 topics, problem set, focused revision"   },
  { value: "intense",  label: "Intense",  sub: "2 deep-dives, timed sets, full-week review" },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function PlannerModal({ dark, onClose, onGenerated }: Props) {
  const { getToken } = useAuth();

  const [subject,   setSubject]   = useState("");
  const [intensity, setIntensity] = useState<PlanIntensity>("moderate");
  const [loading,   setLoading]   = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [preview,   setPreview]   = useState<PreviewTask[] | null>(null);
  const [fallback,  setFallback]  = useState(false);

  const weekStart = getMondayISO();

  async function handleGenerate() {
    if (!subject.trim()) { setError("Please enter a subject."); return; }
    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const { tasks, fallback: fb } = await apiGeneratePlan(token, {
        intensity,
        subject: subject.trim(),
        weekStart,
      });
      setPreview(tasks);
      setFallback(fb);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setConfirming(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const confirmed = await apiConfirmPlan(token, preview);
      onGenerated(confirmed);
      onClose();
    } catch {
      setError("Failed to save tasks. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  /* ── style tokens ── */
  const overlay  = "fixed inset-0 z-50 flex items-center justify-center p-4";
  const glass    = dark ? "rgba(20,6,12,0.97)"       : "rgba(255,246,232,0.98)";
  const border   = dark ? "rgba(203,67,139,0.30)"    : "rgba(203,67,139,0.25)";
  const inputBg  = dark ? "#200910"                  : "#fff";
  const mutedBg  = dark ? "rgba(203,67,139,0.08)"    : "rgba(203,67,139,0.05)";
  const pink     = "#CB438B";

  return (
    <div className={overlay} style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-lg rounded-3xl border shadow-2xl backdrop-blur-2xl flex flex-col max-h-[90vh]"
        style={{ background: glass, borderColor: border }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0 shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: pink, opacity: 0.75 }}>
              weekly planner
            </p>
            <h2 className="text-xl font-bold text-fg-primary">Generate Your Week</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-fg-secondary transition-all hover:scale-110 hover:opacity-70 cursor-pointer border"
            style={{ borderColor: border }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {!preview ? (
            <>
              {/* Subject input */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: pink, opacity: 0.8 }}>
                  What are you studying?
                </label>
                <input
                  type="text"
                  placeholder="e.g. Data Structures, Physics, Spanish…"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#CB438B] text-fg-primary"
                  style={{ background: inputBg, borderColor: border }}
                  autoFocus
                />
              </div>

              {/* Intensity picker */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: pink, opacity: 0.8 }}>
                  Intensity
                </label>
                <div className="flex flex-col gap-2">
                  {INTENSITIES.map((opt) => {
                    const selected = intensity === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setIntensity(opt.value)}
                        className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all hover:scale-[1.01] cursor-pointer"
                        style={{
                          borderColor: selected ? pink : border,
                          background:  selected ? (dark ? "rgba(203,67,139,0.18)" : "rgba(203,67,139,0.10)") : mutedBg,
                          boxShadow:   selected ? `0 0 0 1.5px ${pink}` : "none",
                        }}
                      >
                        <div>
                          <p className="text-sm font-bold" style={{ color: selected ? pink : "var(--fg-primary)" }}>
                            {opt.label}
                          </p>
                          <p className="text-[11px] text-fg-secondary">{opt.sub}</p>
                        </div>
                        {selected && (
                          <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white text-[10px] font-bold"
                            style={{ background: pink }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Week info */}
              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: border, background: mutedBg }}>
                <p className="text-[11px] text-fg-secondary">
                  <span className="font-bold" style={{ color: pink }}>Week:</span>{" "}
                  {DAY_LABELS.map((d, i) => {
                    const date = new Date(weekStart + "T00:00:00");
                    date.setDate(date.getDate() + i);
                    return `${d} ${date.getDate()}`;
                  }).join(" · ")}
                </p>
                <p className="mt-0.5 text-[10px] text-fg-secondary opacity-60">
                  Tasks will be added to your existing task list with Mon–Fri deadlines.
                </p>
              </div>

              {error && (
                <p className="text-xs font-semibold" style={{ color: "#BF3556" }}>{error}</p>
              )}
            </>
          ) : (
            /* Preview state */
            <>
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: pink, opacity: 0.8 }}>
                  Your plan is ready ✓
                </p>
                <p className="text-sm text-fg-secondary">
                  5 tasks created for the week of {formatDate(weekStart)}.
                </p>
                {fallback && (
                  <p className="mt-1.5 text-[11px] text-fg-secondary opacity-70">
                    AI quota reached — generated using smart templates instead.
                  </p>
                )}
              </div>

              <ul className="space-y-2">
                {preview.map((task, i) => (
                  <li key={i}
                    className="flex items-start gap-3 rounded-2xl border px-4 py-3"
                    style={{ borderColor: border, background: mutedBg }}
                  >
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}
                    >
                      {DAY_LABELS[i]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-fg-primary">{task.title}</p>
                      <p className="text-[11px] text-fg-secondary opacity-70">
                        {task.deadline ? formatDate(task.deadline) : ""} · {task.priority} priority
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 pb-5 pt-3 shrink-0 border-t" style={{ borderColor: border }}>
          {preview ? (
            <>
              <button
                onClick={() => setPreview(null)}
                className="rounded-2xl border px-5 py-2.5 text-sm font-bold text-fg-secondary cursor-pointer hover:opacity-70 transition-all"
                style={{ borderColor: border }}
              >
                ← Re-do
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="rounded-2xl px-6 py-2.5 text-sm font-bold text-white cursor-pointer hover:scale-105 transition-all shadow-lg disabled:opacity-60 disabled:scale-100"
                style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}
              >
                {confirming ? "Saving…" : "Add to my tasks ✓"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="rounded-2xl border px-5 py-2.5 text-sm font-bold text-fg-secondary cursor-pointer hover:opacity-70 transition-all"
                style={{ borderColor: border }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="rounded-2xl px-6 py-2.5 text-sm font-bold text-white cursor-pointer hover:scale-105 transition-all shadow-lg disabled:opacity-60 disabled:scale-100"
                style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}
              >
                {loading ? "Generating…" : "Generate Plan →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
