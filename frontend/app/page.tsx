import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { ScrollNav } from "@/components/landing/ScrollNav";
import { ScrollCards } from "@/components/landing/ScrollCards";

export default function Home() {
  return (
    <main className="relative overflow-x-hidden animate-gradient-bg">

      {/* Fixed blobs */}
      <div aria-hidden className="pointer-events-none fixed top-[-120px] left-[-120px] h-[480px] w-[480px] rounded-full blur-3xl opacity-35 animate-float-slow" style={{ background: "#CB438B" }} />
      <div aria-hidden className="pointer-events-none fixed top-[25%] right-[-140px] h-[400px] w-[400px] rounded-full blur-3xl opacity-25 animate-float-medium" style={{ background: "#BF3556" }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[15%] left-[8%] h-[320px] w-[320px] rounded-full blur-3xl opacity-20 animate-float-fast" style={{ background: "#6C6A43" }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[-120px] right-[15%] h-[440px] w-[440px] rounded-full blur-3xl opacity-30 animate-float-slow" style={{ background: "#4D3449" }} />

      {/* Scroll-triggered fixed nav */}
      <ScrollNav />

      {/* HERO — fills full viewport, two-column on large screens */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-12 lg:flex-row lg:items-center lg:justify-center lg:gap-20 lg:px-20">

        {/* LEFT — text content */}
        <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">

          {/* Headline */}
          <div className="animate-fade-up">
            <h2 className="font-display text-6xl font-bold leading-[1.05] tracking-tight sm:text-7xl lg:text-8xl" style={{ color: "#4D3449" }}>
              Study
            </h2>
            <h2 className="font-display animate-shimmer text-6xl font-bold italic leading-[1.05] tracking-tight sm:text-7xl lg:text-8xl">
              Smarter.
            </h2>
            <h2 className="font-display text-6xl font-bold leading-[1.05] tracking-tight sm:text-7xl lg:text-8xl" style={{ color: "#BF3556" }}>
              Glow Up.
            </h2>
          </div>

          {/* Badge */}
          <span
            className="animate-fade-up delay-100 inline-flex items-center gap-2 rounded-full px-5 py-2 text-[11px] font-bold uppercase tracking-widest"
            style={{
              background: "rgba(203,67,139,0.13)",
              color: "#CB438B",
              border: "1px solid rgba(203,67,139,0.32)",
              animationDelay: "120ms",
            }}
          >
            made for girlies who grind
          </span>

          {/* Sub copy */}
          <p
            className="animate-fade-up delay-200 max-w-md text-base leading-relaxed sm:text-lg"
            style={{ color: "#6C6A43" }}
          >
            Track daily missions, crush Pomodoro sessions, and watch your weekly wins stack up — all in your aesthetic study space.
          </p>

          {/* CTAs */}
          <div className="animate-fade-up delay-300 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
            <Link
              href="/sign-up"
              className="animate-pulse-glow rounded-2xl px-8 py-4 text-base font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-2xl"
              style={{ background: "linear-gradient(135deg,#CB438B 0%,#BF3556 100%)" }}
            >
              Start Your Journey
            </Link>
            <Link
              href="/sign-in"
              className="rounded-2xl border-2 px-8 py-4 text-base font-bold transition-all duration-200 hover:scale-105"
              style={{ borderColor: "#4D3449", color: "#4D3449" }}
            >
              Sign In
            </Link>
          </div>

          {/* Scroll hint */}
          <p
            className="animate-fade-up delay-500 text-[11px] font-bold uppercase tracking-[0.25em] animate-bounce-soft"
            style={{ color: "#CB438B", opacity: 0.6 }}
          >
            scroll to explore
          </p>
        </div>

        {/* RIGHT — large floral orbit */}
        <div
          aria-hidden
          className="animate-fade-up delay-400 relative shrink-0 flex items-center justify-center"
          style={{ width: 560, height: 560 }}
        >
          {/* Outer ring — 8 petals */}
          {[0,1,2,3,4,5,6,7].map((i) => (
            <span
              key={i}
              className="absolute animate-orbit-outer"
              style={{ animationDelay: `${-i * 1.25}s` }}
            >
              <Image src={i % 2 === 0 ? "/images/9.png" : "/images/10.png"} alt="" width={54} height={54} className="object-contain" />
            </span>
          ))}

          {/* Inner ring — 4 items, counter-rotate */}
          {[0,1,2,3].map((i) => (
            <span
              key={i}
              className="absolute animate-orbit-inner"
              style={{ animationDelay: `${-i * 1.5}s` }}
            >
              <Image src={i % 2 === 0 ? "/images/11.png" : "/images/12.png"} alt="" width={42} height={42} className="object-contain" />
            </span>
          ))}

          {/* Scattered sparkles */}
          <span className="absolute top-4 right-8 text-xl animate-twinkle" style={{ animationDelay: "0.3s" }}>&#10022;</span>
          <span className="absolute bottom-8 left-4 text-2xl animate-twinkle" style={{ animationDelay: "1.1s" }}>&#10022;</span>
          <span className="absolute top-16 left-2 text-sm animate-twinkle" style={{ animationDelay: "0.7s" }}>&#10022;</span>
          <span className="absolute bottom-16 right-4 text-base animate-twinkle" style={{ animationDelay: "1.8s" }}>&#10022;</span>

          {/* Centre image */}
          <div className="z-10 relative animate-pulse-gentle drop-shadow-xl" style={{ width: 140, height: 140 }}>
            <Image src="/images/8.png" alt="center" fill className="object-contain" />
          </div>
        </div>
      </section>

      {/* SCROLL-REVEAL FEATURE CARDS */}
      <ScrollCards />

      {/* QUOTE / CTA BANNER */}
      <section
        className="relative mx-auto mt-16 mb-12 max-w-6xl overflow-hidden rounded-3xl px-8 py-14 text-center sm:py-20"
        style={{
          background: "linear-gradient(135deg,#4D3449 0%,#BF3556 60%,#CB438B 100%)",
        }}
      >
        {/* Depth glow blobs */}
        <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full blur-3xl opacity-20" style={{ background: "#FFF0D2" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-10 -left-6 h-44 w-44 rounded-full blur-2xl opacity-15" style={{ background: "#FFF0D2" }} />

        {/* Freely floating images — many, varied positions/sizes/speeds */}
        <div aria-hidden className="pointer-events-none absolute animate-float-slow" style={{ width: 50, height: 50, top: "6%", left: "3%", opacity: 0.28, animationDelay: "0s" }}>
          <Image src="/images/1.png" alt="" fill className="object-contain" />
        </div>
        <div aria-hidden className="pointer-events-none absolute animate-float-fast" style={{ width: 32, height: 32, top: "14%", right: "7%", opacity: 0.22, animationDelay: "0.5s" }}>
          <Image src="/images/2.png" alt="" fill className="object-contain" />
        </div>
        <div aria-hidden className="pointer-events-none absolute animate-float-medium" style={{ width: 44, height: 44, bottom: "8%", left: "8%", opacity: 0.24, animationDelay: "1.1s" }}>
          <Image src="/images/3.png" alt="" fill className="object-contain" />
        </div>
        <div aria-hidden className="pointer-events-none absolute animate-float-slow" style={{ width: 28, height: 28, top: "50%", left: "1%", opacity: 0.20, animationDelay: "0.3s" }}>
          <Image src="/images/4.png" alt="" fill className="object-contain" />
        </div>
        <div aria-hidden className="pointer-events-none absolute animate-float-fast" style={{ width: 40, height: 40, bottom: "10%", right: "5%", opacity: 0.26, animationDelay: "0.8s" }}>
          <Image src="/images/5.png" alt="" fill className="object-contain" />
        </div>
        <div aria-hidden className="pointer-events-none absolute animate-float-medium" style={{ width: 26, height: 26, top: "22%", right: "2%", opacity: 0.18, animationDelay: "1.5s" }}>
          <Image src="/images/6.png" alt="" fill className="object-contain" />
        </div>
        <div aria-hidden className="pointer-events-none absolute animate-float-slow" style={{ width: 36, height: 36, bottom: "28%", left: "6%", opacity: 0.22, animationDelay: "0.4s" }}>
          <Image src="/images/11.png" alt="" fill className="object-contain" />
        </div>
        <div aria-hidden className="pointer-events-none absolute animate-float-fast" style={{ width: 30, height: 30, top: "62%", right: "11%", opacity: 0.20, animationDelay: "1.9s" }}>
          <Image src="/images/12.png" alt="" fill className="object-contain" />
        </div>

        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">
          daily dose
        </p>
        <blockquote className="font-display text-2xl font-bold italic leading-snug text-white sm:text-4xl lg:text-5xl">
          &ldquo;Small progress is still progress.&rdquo;
        </blockquote>
        <p className="mt-5 text-sm text-white/60">
          Join students who study with style and actually show up.
        </p>
        <Link
          href="/sign-up"
          className="mt-8 inline-block rounded-2xl px-10 py-4 text-base font-bold shadow-xl transition-all duration-200 hover:scale-105 hover:shadow-2xl"
          style={{ background: "#FFF0D2", color: "#BF3556" }}
        >
          Get Started Free
        </Link>
      </section>

      {/* FOOTER */}
      <footer
        className="relative z-10 pb-10 text-center text-xs"
        style={{ color: "#6C6A43" }}
      >
        Study Buddy &mdash; built with love for students who show up every day
      </footer>
    </main>
  );
}
