"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Quote } from "@/lib/quoterism";

const FALLBACK: Quote = {
  id: "fallback",
  text: "Small progress is still progress.",
  author: { id: "fallback", name: "Zenith" },
};

type State =
  | { status: "loading" }
  | { status: "ok"; quote: Quote }
  | { status: "error"; quote: Quote };

export function QuoteBanner() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/quote?id=quote-of-the-day")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<Quote>;
      })
      .then((quote) => {
        if (!cancelled) setState({ status: "ok", quote });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", quote: FALLBACK });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const quote = state.status === "loading" ? null : state.quote;

  return (
    <>
      <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">
        daily dose
      </p>

      {/* Quote text */}
      {state.status === "loading" ? (
        /* Skeleton shimmer */
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          <div className="h-8 w-3/4 animate-pulse rounded-xl bg-white/20" />
          <div className="h-8 w-1/2 animate-pulse rounded-xl bg-white/15" />
          <div className="mt-2 h-4 w-28 animate-pulse rounded-full bg-white/10" />
        </div>
      ) : (
        <div className="mx-auto max-w-2xl">
          <blockquote className="font-display text-2xl font-bold italic leading-snug text-white sm:text-4xl lg:text-5xl">
            &ldquo;{quote!.text}&rdquo;
          </blockquote>
          <p className="mt-4 text-sm font-semibold tracking-wide text-white/70">
            — {quote!.author.name}
          </p>
        </div>
      )}

      <p className="mt-6 text-sm text-white/60">
        Join students who study with style and actually show up.
      </p>
      <Link
        href="/sign-up"
        className="mt-8 inline-block rounded-2xl px-10 py-4 text-base font-bold shadow-xl transition-all duration-200 hover:scale-105 hover:shadow-2xl"
        style={{ background: "#FFF0D2", color: "#BF3556" }}
      >
        Get Started Free
      </Link>
    </>
  );
}
