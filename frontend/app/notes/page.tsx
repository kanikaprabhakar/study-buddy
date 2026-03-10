"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { type Note, fetchNotes, apiCreateNote, apiDeleteNote } from "@/lib/tasks";

const FLOATERS = [
  { src: "/images/15.png", w: 95,  top: "5%",    left: "0%",   anim: "animate-float-slow",   delay: "0s" },
  { src: "/images/20.png", w: 85,  top: "18%",   right: "0%",  anim: "animate-float-medium", delay: "1.2s" },
  { src: "/images/11.png", w: 80,  top: "50%",   left: "0%",   anim: "animate-float-fast",   delay: "0.7s" },
  { src: "/images/23.png", w: 90,  top: "65%",   right: "0%",  anim: "animate-float-slow",   delay: "1.9s" },
  { src: "/images/9.png",  w: 72,  bottom: "12%",left: "1%",   anim: "animate-float-medium", delay: "1.0s" },
  { src: "/images/16.png", w: 88,  bottom: "3%", right: "1%",  anim: "animate-float-fast",   delay: "0.4s" },
] as const;

/** Strip HTML tags for plain-text preview */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Format updatedAt nicely */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function NotesPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const { getToken } = useAuth();
  const router = useRouter();

  const [notes, setNotes]     = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!token || cancelled) return;
      fetchNotes(token)
        .then((n) => { if (!cancelled) setNotes(n); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNew = useCallback(async () => {
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) return;
      const note = await apiCreateNote(token, { heading: "Untitled", content: "" });
      router.push(`/notes/${note.id}`);
    } catch (err) {
      console.error("Create note failed:", err);
      setCreating(false);
    }
  }, [getToken, router]);

  const handleDelete = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      const token = await getToken();
      if (!token) throw new Error("no token");
      await apiDeleteNote(token, id);
    } catch {
      const token = await getToken();
      if (token) fetchNotes(token).then(setNotes).catch(() => {});
    }
  }, [getToken]);

  const cardBg  = dark ? "rgba(28,11,16,0.82)"  : "rgba(255,240,210,0.82)";
  const cardBdr = dark ? "rgba(203,67,139,0.28)" : "rgba(203,67,139,0.22)";

  return (
    <main className="relative min-h-screen overflow-x-hidden animate-gradient-bg">

      {/* Blobs */}
      <div aria-hidden className="pointer-events-none fixed top-[-80px] left-[-80px] h-[340px] w-[340px] rounded-full blur-3xl opacity-25 animate-float-slow"   style={{ background: "#CB438B" }} />
      <div aria-hidden className="pointer-events-none fixed top-[35%] right-[-100px] h-[300px] w-[300px] rounded-full blur-3xl opacity-18 animate-float-medium" style={{ background: "#BF3556" }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[10%] left-[4%] h-[240px] w-[240px] rounded-full blur-3xl opacity-14 animate-float-fast"    style={{ background: "#6C6A43" }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[-60px] right-[8%] h-[310px] w-[310px] rounded-full blur-3xl opacity-20 animate-float-slow"  style={{ background: "#4D3449" }} />

      {FLOATERS.map((f, i) => (
        <span key={i} aria-hidden className={`pointer-events-none fixed ${f.anim}`}
          style={{ top: (f as Record<string,unknown>).top as string, bottom: (f as Record<string,unknown>).bottom as string, left: (f as Record<string,unknown>).left as string, right: (f as Record<string,unknown>).right as string, animationDelay: f.delay, opacity: 0.65, zIndex: 1 }}>
          <Image src={f.src} alt="" width={f.w} height={f.w} className="object-contain" />
        </span>
      ))}

      {/* Nav */}
      <div className="sticky top-0 z-50 px-4 pt-3 sm:px-6">
        <header className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl border px-5 py-3 shadow-xl backdrop-blur-xl"
          style={{ background: "var(--nav-glass)", borderColor: "var(--nav-border)" }}>
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-bold transition-all hover:scale-105 text-fg-primary">
            <Image src={dark ? "/images/1.png" : "/images/5.png"} alt="" width={22} height={22} className="object-contain" />
            ← Dashboard
          </Link>
          <span className="font-display text-base font-bold italic text-fg-primary hidden sm:block">Notes</span>
          <ThemeToggle />
        </header>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">

        {/* Page heading */}
        <div className="mt-8 mb-8 flex flex-col items-center text-center animate-fade-up">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#CB438B", opacity: 0.75 }}>your thoughts</p>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">
            <span className="text-fg-primary">All </span>
            <span className="animate-shimmer italic">Notes.</span>
          </h1>
          <p className="mt-2 text-sm text-fg-secondary">click a note to open it, or make a new one.</p>
        </div>

        {/* New Note button */}
        <div className="mb-8 flex justify-center">
          <button
            onClick={handleNew}
            disabled={creating}
            className="flex items-center gap-2 rounded-2xl px-7 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 animate-pulse-glow cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}
          >
            {creating ? "Creating…" : "+ New Note"}
          </button>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
            {[1,2,3,4,5,6].map((n) => (
              <div key={n} className="h-44 rounded-2xl"
                style={{ background: dark ? "rgba(203,67,139,0.10)" : "rgba(203,67,139,0.07)" }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && notes.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 opacity-70">
            <p className="text-lg font-bold text-fg-primary">Nothing here yet!</p>
            <p className="text-sm italic text-fg-secondary">Hit &ldquo;+ New Note&rdquo; to start writing.</p>
          </div>
        )}

        {/* Notes grid */}
        {!loading && notes.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => {
              const preview = stripHtml(note.content);
              return (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="group relative flex flex-col justify-between rounded-2xl border p-5 backdrop-blur-xl transition-all hover:scale-[1.02] hover:shadow-xl"
                  style={{ background: cardBg, borderColor: cardBdr, minHeight: "11rem" }}
                >
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, note.id)}
                    aria-label="Delete note"
                    className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-all hover:scale-110 cursor-pointer"
                    style={{ background: dark ? "rgba(191,53,86,0.30)" : "rgba(191,53,86,0.18)", color: "#BF3556" }}
                  >
                    ✕
                  </button>

                  {/* Heading */}
                  <div>
                    <h2 className="pr-7 text-base font-bold text-fg-primary line-clamp-2 leading-snug mb-1">
                      {note.heading}
                    </h2>
                    {note.description && (
                      <p className="text-xs text-fg-secondary mb-2 line-clamp-1 italic">{note.description}</p>
                    )}
                    {preview && (
                      <p className="text-xs text-fg-secondary line-clamp-4 leading-relaxed">{preview}</p>
                    )}
                    {!preview && (
                      <p className="text-xs italic opacity-40 text-fg-secondary">empty note</p>
                    )}
                  </div>

                  {/* Footer */}
                  <p className="mt-4 text-[10px] font-medium uppercase tracking-wider" style={{ color: "#CB438B", opacity: 0.65 }}>
                    {fmtDate(note.updatedAt)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
