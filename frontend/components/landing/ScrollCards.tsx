"use client";

import Image from "next/image";
import ScrollStack, { ScrollStackItem } from "./ScrollStack";

const CARDS = [
  {
    img: "/images/2.png",
    title: "Daily Planner",
    body: "Set your study intentions every morning. Goals feel lighter when written down.",
    bgT: "rgba(203,67,139,0.12)",
    bgS: "#F7DEED",
    border: "rgba(203,67,139,0.35)",
    accent: "#CB438B",
    tag: "plan",
  },
  {
    img: "/images/3.png",
    title: "Pomodoro Timer",
    body: "25 min focus, 5 min break. Lock in, reward yourself, repeat.",
    bgT: "rgba(191,53,86,0.12)",
    bgS: "#F9DEEB",
    border: "rgba(191,53,86,0.35)",
    accent: "#BF3556",
    tag: "focus",
  },
  {
    img: "/images/4.png",
    title: "Progress Tracker",
    body: "Visual bars, weekly streaks. Watch your consistency compound beautifully.",
    bgT: "rgba(108,106,67,0.10)",
    bgS: "#EEEEE6",
    border: "rgba(108,106,67,0.32)",
    accent: "#6C6A43",
    tag: "track",
  },
  {
    img: "/images/5.png",
    title: "Daily Motivation",
    body: "A fresh quote every day to keep your head in the game and your vibe right.",
    bgT: "rgba(77,52,73,0.10)",
    bgS: "#ECE9ED",
    border: "rgba(77,52,73,0.28)",
    accent: "#4D3449",
    tag: "inspire",
  },
  {
    img: "/images/6.png",
    title: "Aesthetic Space",
    body: "Because your study environment matters. Soft, focused, and made for you.",
    bgT: "rgba(203,67,139,0.10)",
    bgS: "#F7DEED",
    border: "rgba(203,67,139,0.28)",
    accent: "#CB438B",
    tag: "vibe",
  },
  {
    img: "/images/7.png",
    title: "Backend Sync",
    body: "Data saved securely. Show up on any device, pick up right where you left off.",
    bgT: "rgba(191,53,86,0.10)",
    bgS: "#F9DEEB",
    border: "rgba(191,53,86,0.28)",
    accent: "#BF3556",
    tag: "sync",
  },
] as const;

export function ScrollCards() {
  return (
    <section className="pb-32 pt-8">
      {/* Section label */}
      <div className="mb-12 px-4 text-center">
        <p
          className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em]"
          style={{ color: "#CB438B" }}
        >
          everything you need
        </p>
        <h2
          className="font-display text-3xl font-bold sm:text-4xl"
          style={{ color: "#4D3449" }}
        >
          Built for your best self.
        </h2>
      </div>

      <ScrollStack
        useWindowScroll={true}
        itemDistance={120}
        itemScale={0.04}
        itemStackDistance={28}
        stackPosition="18%"
        scaleEndPosition="8%"
        baseScale={0.88}
        blurAmount={0.6}
      >
        {CARDS.map(({ img, title, body, bgT, bgS, border, accent, tag }) => (
          <ScrollStackItem
            key={title}
            style={{
              ["--card-bg-t" as string]: bgT,
              ["--card-bg-s" as string]: bgS,
            }}
          >
            <div
              className="card-bg-layer relative overflow-hidden rounded-3xl border px-8 py-10"
              style={{ borderColor: border }}
            >
              {/* Decorative corner glow */}
              <div
                className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-2xl opacity-20"
                style={{ background: accent }}
              />

              {/* Top row: tag pill + image icon */}
              <div className="mb-6 flex items-center justify-between">
                <span
                  className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{
                    background: `${accent}18`,
                    color: accent,
                    border: `1px solid ${accent}40`,
                  }}
                >
                  {tag}
                </span>
                <Image src={img} alt={title} width={64} height={64} className="object-contain" />
              </div>

              {/* Title */}
              <h3
                className="font-display mb-3 text-2xl font-bold sm:text-3xl"
                style={{ color: "#4D3449" }}
              >
                {title}
              </h3>

              {/* Body */}
              <p className="text-base leading-relaxed" style={{ color: "#6C6A43" }}>
                {body}
              </p>

              {/* Bottom accent bar */}
              <div
                className="mt-8 h-1 w-16 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${accent}, transparent)`,
                }}
              />
            </div>
          </ScrollStackItem>
        ))}
      </ScrollStack>
    </section>
  );
}
