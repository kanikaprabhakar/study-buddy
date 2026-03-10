// @ts-nocheck
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fetchNote, apiPatchNote } from "@/lib/tasks";

const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Pink",    value: "#CB438B" },
  { label: "Red",     value: "#BF3556" },
  { label: "Orange",  value: "#d97706" },
  { label: "Yellow",  value: "#ca8a04" },
  { label: "Green",   value: "#16a34a" },
  { label: "Teal",    value: "#0d9488" },
  { label: "Blue",    value: "#2563eb" },
  { label: "Violet",  value: "#7c3aed" },
  { label: "Gray",    value: "#6b7280" },
];

const HIGHLIGHT_COLORS = [
  { label: "None",   value: "" },
  { label: "Yellow", value: "#fef08a" },
  { label: "Pink",   value: "#fbcfe8" },
  { label: "Green",  value: "#bbf7d0" },
  { label: "Blue",   value: "#bfdbfe" },
  { label: "Violet", value: "#ddd6fe" },
  { label: "Orange", value: "#fed7aa" },
];

function useDebouncedCallback(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

function SwatchGrid({ colors, active, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button key={c.value} type="button" title={c.label}
          onMouseDown={(e) => { e.preventDefault(); onPick(c.value); }}
          className="h-6 w-6 rounded-md border-2 transition-all hover:scale-110 cursor-pointer"
          style={{
            background: c.value ? c.value : "repeating-linear-gradient(45deg,#aaa 0,#aaa 2px,transparent 2px,transparent 8px)",
            borderColor: active === c.value ? "#CB438B" : "rgba(203,67,139,0.25)",
          }} />
      ))}
    </div>
  );
}

function TextColourPicker({ onPick, dark }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  function pick(v) { setActive(v); onPick(v); setOpen(false); }
  return (
    <div ref={ref} className="relative">
      <button type="button" title="Text colour"
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="flex h-8 w-9 flex-col items-center justify-center gap-[3px] rounded-lg cursor-pointer border transition-all hover:scale-110 px-1 overflow-hidden"
        style={{ borderColor: "rgba(203,67,139,0.30)", background: dark ? "rgba(203,67,139,0.10)" : "rgba(203,67,139,0.07)" }}>
        <span className="text-[12px] font-extrabold leading-none" style={{ color: "var(--fg-primary)" }}>A</span>
        <span className="w-full h-[4px] rounded-[2px]" style={{ background: active || "#CB438B" }} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 rounded-xl border p-2.5 shadow-2xl backdrop-blur-xl"
          style={{ background: dark ? "rgba(20,6,12,0.96)" : "rgba(255,246,232,0.97)", borderColor: "rgba(203,67,139,0.3)", width: "168px" }}>
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: "#CB438B", opacity: 0.7 }}>Text colour</p>
          <SwatchGrid colors={TEXT_COLORS} active={active} onPick={pick} />
        </div>
      )}
    </div>
  );
}

function HighlightPicker({ onPick, dark }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  function pick(v) { setActive(v); onPick(v); setOpen(false); }
  return (
    <div ref={ref} className="relative">
      <button type="button" title="Highlight colour"
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="flex h-8 w-9 flex-col items-center justify-center gap-[3px] rounded-lg cursor-pointer border transition-all hover:scale-110 px-1 overflow-hidden"
        style={{ borderColor: "rgba(203,67,139,0.30)", background: active || (dark ? "rgba(203,67,139,0.10)" : "rgba(203,67,139,0.07)") }}>
        <span className="text-[11px] font-bold leading-none" style={{ color: active ? "#222" : "var(--fg-primary)" }}>ab</span>
        <span className="w-full h-[4px] rounded-[2px]" style={{ background: active || "#fef08a" }} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 rounded-xl border p-2.5 shadow-2xl backdrop-blur-xl"
          style={{ background: dark ? "rgba(20,6,12,0.96)" : "rgba(255,246,232,0.97)", borderColor: "rgba(203,67,139,0.3)", width: "168px" }}>
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: "#CB438B", opacity: 0.7 }}>Highlight</p>
          <SwatchGrid colors={HIGHLIGHT_COLORS} active={active} onPick={pick} />
        </div>
      )}
    </div>
  );
}

function LinkDialog({ onInsert, onClose, dark }) {
  const [url, setUrl] = useState("https://");
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const bg  = dark ? "#200910" : "#fff";
  const bdr = dark ? "rgba(203,67,139,0.30)" : "rgba(203,67,139,0.25)";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-sm rounded-2xl border p-6 shadow-2xl backdrop-blur-2xl"
        style={{ background: dark ? "rgba(20,6,12,0.97)" : "rgba(255,246,232,0.97)", borderColor: "rgba(203,67,139,0.35)" }}>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider" style={{ color: "#CB438B" }}>Insert Link</h3>
        <div className="flex flex-col gap-3">
          <input ref={inputRef} type="url" placeholder="https://example.com" value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onInsert(url, text); } if (e.key === "Escape") onClose(); }}
            className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#CB438B]"
            style={{ background: bg, borderColor: bdr, color: "var(--fg-primary)" }} />
          <input type="text" placeholder="Link text (leave blank to wrap selection)" value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onInsert(url, text); } if (e.key === "Escape") onClose(); }}
            className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#CB438B]"
            style={{ background: bg, borderColor: bdr, color: "var(--fg-primary)" }} />
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-bold cursor-pointer hover:opacity-70 border"
            style={{ borderColor: bdr, color: "var(--fg-secondary)" }}>Cancel</button>
          <button type="button" onClick={() => onInsert(url, text)}
            className="rounded-xl px-5 py-2 text-sm font-bold text-white cursor-pointer hover:scale-105 transition-all"
            style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)" }}>Insert</button>
        </div>
      </div>
    </div>
  );
}

export default function NoteEditorPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const { getToken } = useAuth();
  const params = useParams();
  const id = String(params.id);

  const [heading,     setHeading]     = useState("Untitled");
  const [description, setDescription] = useState("");
  const [saveStatus,  setSaveStatus]  = useState("saved");
  const [loadErr,     setLoadErr]     = useState(false);
  const [linkDialog,  setLinkDialog]  = useState(false);
  const [activeFmt,   setActiveFmt]   = useState({ bold: false, italic: false, underline: false });

  const editorRef   = useRef(null);
  const savedSelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getToken().then(async (token) => {
      if (!token || cancelled) return;
      try {
        const note = await fetchNote(token, id);
        if (cancelled) return;
        setHeading(note.heading);
        setDescription(note.description ?? "");
        if (editorRef.current) editorRef.current.innerHTML = note.content;
        setSaveStatus("saved");
      } catch { if (!cancelled) setLoadErr(true); }
    });
    return () => { cancelled = true; };
  }, [id]);

  const persist = useCallback(async (h, d, content) => {
    try {
      const token = await getToken();
      if (!token) return;
      setSaveStatus("saving");
      await apiPatchNote(token, id, { heading: h, description: d || undefined, content });
      setSaveStatus("saved");
    } catch { setSaveStatus("unsaved"); }
  }, [getToken, id]);

  const debouncedSave = useDebouncedCallback(persist, 1200);

  function triggerSave(h, d) {
    setSaveStatus("unsaved");
    debouncedSave(h ?? heading, d ?? description, editorRef.current?.innerHTML ?? "");
  }

  function updateFmt() {
    setActiveFmt({
      bold:      document.queryCommandState("bold"),
      italic:    document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
    });
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedSelRef.current = sel.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    const sel = window.getSelection();
    if (sel && savedSelRef.current) { sel.removeAllRanges(); sel.addRange(savedSelRef.current); }
  }

  function execAndFocus(command, value) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateFmt();
    triggerSave();
  }

  function handleInsertLink(rawUrl, linkText) {
    setLinkDialog(false);
    if (!rawUrl || rawUrl === "https://") return;
    const safe = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
    editorRef.current?.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (linkText.trim() && sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const a = document.createElement("a");
      a.href = safe; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.textContent = linkText.trim();
      range.insertNode(a);
      const nr = document.createRange();
      nr.setStartAfter(a); nr.collapse(true);
      sel.removeAllRanges(); sel.addRange(nr);
    } else {
      document.execCommand("createLink", false, safe);
    }
    editorRef.current?.querySelectorAll("a").forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
    triggerSave();
  }

  const panelBg  = dark ? "rgba(28,11,16,0.88)"  : "rgba(255,240,210,0.88)";
  const panelBdr = dark ? "rgba(203,67,139,0.28)" : "rgba(203,67,139,0.22)";
  const inputBdr = dark ? "rgba(203,67,139,0.30)" : "rgba(203,67,139,0.25)";

  function toolBtn(title, children, onClick, active) {
    return (
      <button key={title} type="button" title={title}
        onMouseDown={(e) => { e.preventDefault(); onClick(); }}
        className="flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-bold transition-all hover:scale-110 cursor-pointer select-none"
        style={{
          background: active ? "rgba(203,67,139,0.28)" : (dark ? "rgba(203,67,139,0.10)" : "rgba(203,67,139,0.07)"),
          color: active ? "#CB438B" : "var(--fg-primary)",
          border: `1px solid ${active ? "rgba(203,67,139,0.55)" : "rgba(203,67,139,0.22)"}`,
        }}>
        {children}
      </button>
    );
  }

  if (loadErr) return (
    <main className="flex min-h-screen items-center justify-center animate-gradient-bg">
      <div className="text-center">
        <p className="text-lg font-bold text-fg-primary mb-4">Note not found.</p>
        <Link href="/notes" className="text-sm font-bold" style={{ color: "#CB438B" }}>&larr; Back to Notes</Link>
      </div>
    </main>
  );

  return (
    <main className="relative min-h-screen overflow-x-hidden animate-gradient-bg">
      <div aria-hidden className="pointer-events-none fixed top-[-80px] left-[-80px] h-[340px] w-[340px] rounded-full blur-3xl opacity-20 animate-float-slow" style={{ background: "#CB438B" }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[-60px] right-[8%] h-[310px] w-[310px] rounded-full blur-3xl opacity-15 animate-float-slow" style={{ background: "#4D3449" }} />

      {linkDialog && <LinkDialog onInsert={handleInsertLink} onClose={() => setLinkDialog(false)} dark={dark} />}

      <div className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
        <header className="mx-auto flex max-w-3xl items-center justify-between rounded-2xl border px-5 py-3 shadow-xl backdrop-blur-xl"
          style={{ background: "var(--nav-glass)", borderColor: "var(--nav-border)" }}>
          <Link href="/notes" className="flex items-center gap-2 text-sm font-bold transition-all hover:scale-105 text-fg-primary">
            <Image src={dark ? "/images/1.png" : "/images/5.png"} alt="" width={22} height={22} className="object-contain" />
            &larr; Notes
          </Link>
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{
            color: saveStatus === "saved" ? "#16a34a" : saveStatus === "saving" ? "#CB438B" : "#d97706",
          }}>
            {saveStatus === "saved"   && <><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />Saved to your account</>}
            {saveStatus === "saving"  && <><span className="h-2 w-2 rounded-full bg-pink-500 animate-pulse inline-block" />Saving&hellip;</>}
            {saveStatus === "unsaved" && <><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />Unsaved changes</>}
          </span>
          <ThemeToggle />
        </header>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-20 sm:px-6">
        <div className="mt-8 mb-5 animate-fade-up">
          <input type="text" value={heading}
            onChange={(e) => { setHeading(e.target.value); triggerSave(e.target.value, description); }}
            placeholder="Note heading&hellip;"
            className="w-full bg-transparent text-3xl font-bold text-fg-primary placeholder:opacity-30 outline-none border-b pb-2 mb-3"
            style={{ borderColor: inputBdr }} />
          <input type="text" value={description}
            onChange={(e) => { setDescription(e.target.value); triggerSave(heading, e.target.value); }}
            placeholder="Short description (optional)&hellip;"
            className="w-full bg-transparent text-sm text-fg-secondary placeholder:opacity-30 outline-none" />
        </div>

        <div className="rounded-2xl border backdrop-blur-xl overflow-visible" style={{ background: panelBg, borderColor: panelBdr }}>
          <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5" style={{ borderColor: panelBdr }}>
            {toolBtn("Bold",      <b>B</b>,     () => execAndFocus("bold"),      activeFmt.bold)}
            {toolBtn("Italic",    <i>I</i>,     () => execAndFocus("italic"),    activeFmt.italic)}
            {toolBtn("Underline", <u>U</u>,     () => execAndFocus("underline"), activeFmt.underline)}
            <div className="h-6 w-px mx-0.5" style={{ background: "rgba(203,67,139,0.25)" }} />
            {toolBtn("Bullet list",   <>&bull; &mdash;</>, () => execAndFocus("insertUnorderedList"))}
            {toolBtn("Numbered list", <>1. &mdash;</>,     () => execAndFocus("insertOrderedList"))}
            <div className="h-6 w-px mx-0.5" style={{ background: "rgba(203,67,139,0.25)" }} />
            <TextColourPicker dark={dark} onPick={(v) => execAndFocus("foreColor", v || "#000000")} />
            <HighlightPicker  dark={dark} onPick={(v) => execAndFocus("hiliteColor", v || "transparent")} />
            <div className="h-6 w-px mx-0.5" style={{ background: "rgba(203,67,139,0.25)" }} />
            {toolBtn("Insert link",      <>🔗 link</>,   () => { saveSelection(); setLinkDialog(true); })}
            {toolBtn("Clear formatting", <>&times; clear</>, () => execAndFocus("removeFormat"))}
          </div>

          <div ref={editorRef} contentEditable suppressContentEditableWarning
            onInput={() => triggerSave()}
            onKeyUp={updateFmt}
            onMouseUp={updateFmt}
            onSelect={updateFmt}
            className="min-h-[440px] w-full px-6 py-5 text-sm leading-relaxed outline-none text-fg-primary"
            style={{ wordBreak: "break-word" }}
            data-placeholder="Start writing&hellip;" />
        </div>
      </div>

      <style>{`
        [data-placeholder]:empty:before { content: attr(data-placeholder); color: var(--fg-secondary,#888); opacity:.38; pointer-events:none; }
        [contenteditable] a { color:#CB438B; text-decoration:underline; cursor:pointer; }
        [contenteditable] a:hover { opacity:.78; }
        [contenteditable] ul { list-style:disc; padding-left:1.6rem; margin:.3rem 0; }
        [contenteditable] ol { list-style:decimal; padding-left:1.6rem; margin:.3rem 0; }
      `}</style>
    </main>
  );
}
