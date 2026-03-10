"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { useTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  type Resource,
  fetchResources,
  apiCreateResource,
  apiPatchResource,
  apiDeleteResource,
} from "@/lib/tasks";

const FLOATERS = [
  { src: "/images/14.png", w: 100, top: "3%",    left: "0%",   anim: "animate-float-slow",   delay: "0s" },
  { src: "/images/18.png", w: 90,  top: "15%",   right: "0%",  anim: "animate-float-medium", delay: "1.4s" },
  { src: "/images/12.png", w: 80,  top: "45%",   left: "0%",   anim: "animate-float-fast",   delay: "0.8s" },
  { src: "/images/21.png", w: 95,  top: "60%",   right: "0%",  anim: "animate-float-slow",   delay: "2.0s" },
  { src: "/images/10.png", w: 75,  bottom: "15%",left: "1%",   anim: "animate-float-medium", delay: "1.1s" },
  { src: "/images/24.png", w: 88,  bottom: "4%", right: "1%",  anim: "animate-float-fast",   delay: "0.5s" },
] as const;

const EMPTY_FORM = { name: "", url: "", description: "" };

function getFavicon(url: string) {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return null;
  }
}

export default function ResourcesPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const { getToken } = useAuth();

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [search, setSearch]       = useState("");

  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!token || cancelled) return;
      fetchResources(token)
        .then((r) => { if (!cancelled) setResources(r); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) return;
    // Prefix https:// if no protocol given
    const safeUrl = /^https?:\/\//i.test(form.url.trim())
      ? form.url.trim()
      : `https://${form.url.trim()}`;
    const token = await getToken();
    if (!token) return;
    try {
      if (editId) {
        const updated = await apiPatchResource(token, editId, {
          name:        form.name,
          url:         safeUrl,
          description: form.description || undefined,
        });
        setResources((prev) => prev.map((r) => r.id === editId ? updated : r));
        setEditId(null);
      } else {
        const created = await apiCreateResource(token, {
          name:        form.name,
          url:         safeUrl,
          description: form.description || undefined,
        });
        setResources((prev) => [created, ...prev]);
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      console.error("Resource mutation failed:", err);
    }
  }, [form, editId, getToken]);

  const handleDelete = useCallback(async (id: string) => {
    setResources((prev) => prev.filter((r) => r.id !== id));
    try {
      const token = await getToken();
      if (!token) throw new Error("no token");
      await apiDeleteResource(token, id);
    } catch {
      const token = await getToken();
      if (token) fetchResources(token).then(setResources).catch(() => {});
    }
  }, [getToken]);

  function startEdit(r: Resource) {
    setForm({ name: r.name, url: r.url, description: r.description ?? "" });
    setEditId(r.id);
    setShowForm(true);
  }

  function cancelForm() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
  }

  const cardBg  = dark ? "rgba(28,11,16,0.80)"  : "rgba(255,240,210,0.80)";
  const cardBdr = dark ? "rgba(203,67,139,0.28)" : "rgba(203,67,139,0.20)";
  const inputBg = dark ? "#2A0E15" : "#fff";
  const inputBdr = dark ? "rgba(203,67,139,0.30)" : "rgba(203,67,139,0.25)";

  const filtered = resources.filter((r) =>
    search === "" ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.url.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="relative min-h-screen overflow-x-hidden animate-gradient-bg">

      {/* Blobs */}
      <div aria-hidden className="pointer-events-none fixed top-[-80px] left-[-80px] h-[340px] w-[340px] rounded-full blur-3xl opacity-25 animate-float-slow"   style={{ background: "#CB438B" }} />
      <div aria-hidden className="pointer-events-none fixed top-[35%] right-[-100px] h-[300px] w-[300px] rounded-full blur-3xl opacity-18 animate-float-medium" style={{ background: "#BF3556" }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[10%] left-[4%] h-[240px] w-[240px] rounded-full blur-3xl opacity-14 animate-float-fast"    style={{ background: "#6C6A43" }} />
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
          style={{ background: "var(--nav-glass)", borderColor: "var(--nav-border)" }}>
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-bold transition-all hover:scale-105 text-fg-primary">
            <Image src={dark ? "/images/1.png" : "/images/5.png"} alt="" width={22} height={22} className="object-contain" />
            ← Dashboard
          </Link>
          <span className="font-display text-base font-bold italic text-fg-primary hidden sm:block">Resources</span>
          <ThemeToggle />
        </header>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-20 sm:px-6">

        {/* Header */}
        <div className="mt-8 mb-6 flex flex-col items-center text-center animate-fade-up">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#CB438B", opacity: 0.75 }}>bookmarks</p>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">
            <span className="text-fg-primary">Your </span>
            <span className="animate-shimmer italic">Resources.</span>
          </h1>
          <p className="mt-2 text-sm text-fg-secondary">all your important links, one place.</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 rounded-2xl"
                style={{ background: dark ? "rgba(203,67,139,0.10)" : "rgba(203,67,139,0.07)" }} />
            ))}
          </div>
        )}

        {!loading && (<>

        {/* Search + Add */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search resources…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#CB438B]"
            style={{ background: inputBg, borderColor: inputBdr, color: "var(--fg-primary)" }}
          />
          <button onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); }}
            className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 animate-pulse-glow"
            style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
            + Add Link
          </button>
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div className="mb-6 animate-fade-up rounded-2xl border p-5 backdrop-blur-xl sm:p-6"
            style={{ background: cardBg, borderColor: cardBdr }}>
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider" style={{ color: "#CB438B" }}>
              {editId ? "Edit Link" : "New Link"}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input required placeholder="Name (e.g. MDN Docs)" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#CB438B]"
                style={{ background: inputBg, borderColor: inputBdr, color: "var(--fg-primary)" }} />
              <input required placeholder="URL (e.g. developer.mozilla.org)" value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#CB438B]"
                style={{ background: inputBg, borderColor: inputBdr, color: "var(--fg-primary)" }} />
              <input placeholder="Description (optional)" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#CB438B]"
                style={{ background: inputBg, borderColor: inputBdr, color: "var(--fg-primary)" }} />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={cancelForm}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold text-fg-secondary transition-all hover:scale-105"
                  style={{ border: `1px solid ${inputBdr}`, background: dark ? "rgba(203,67,139,0.08)" : "rgba(203,67,139,0.06)" }}>
                  Cancel
                </button>
                <button type="submit"
                  className="rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>
                  {editId ? "Save" : "Add Link"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 opacity-70">
            <p className="text-sm italic text-fg-secondary">
              {search ? "No results matching your search." : "No links saved yet — add one above!"}
            </p>
          </div>
        )}

        {/* Resource list */}
        {filtered.length > 0 && (
          <ul className="space-y-3">
            {filtered.map((r) => {
              const favicon = getFavicon(r.url);
              let hostname = "";
              try { hostname = new URL(r.url).hostname.replace(/^www\./, ""); } catch { hostname = r.url; }
              return (
                <li key={r.id}
                  className="group flex items-center gap-4 rounded-2xl border p-4 backdrop-blur-xl transition-all duration-200 hover:scale-[1.01]"
                  style={{ background: cardBg, borderColor: cardBdr }}>
                  {/* Favicon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: dark ? "rgba(203,67,139,0.12)" : "rgba(203,67,139,0.08)" }}>
                    {favicon
                      ? <img src={favicon} alt="" width={20} height={20} className="rounded" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      : <span style={{ color: "#CB438B", fontSize: 18 }}>🔗</span>}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-bold text-fg-primary hover:underline leading-snug block truncate"
                      style={{ color: "var(--fg-primary)" }}>
                      {r.name}
                    </a>
                    <p className="text-xs text-fg-secondary truncate" style={{ color: "#CB438B", opacity: 0.75 }}>{hostname}</p>
                    {r.description && (
                      <p className="mt-0.5 text-xs text-fg-secondary truncate">{r.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg px-2 py-1 text-xs font-bold transition-all hover:scale-110"
                      style={{ background: dark ? "rgba(203,67,139,0.15)" : "rgba(203,67,139,0.10)", color: "#CB438B" }}>
                      Open
                    </a>
                    <button onClick={() => startEdit(r)} aria-label="Edit"
                      className="rounded-lg px-2 py-1 text-xs font-bold transition-all hover:scale-110"
                      style={{ background: dark ? "rgba(203,67,139,0.15)" : "rgba(203,67,139,0.10)", color: "#CB438B" }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(r.id)} aria-label="Delete"
                      className="rounded-lg px-2 py-1 text-xs font-bold transition-all hover:scale-110"
                      style={{ background: dark ? "rgba(191,53,86,0.15)" : "rgba(191,53,86,0.10)", color: "#BF3556" }}>
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        </>)}
      </div>
    </main>
  );
}
