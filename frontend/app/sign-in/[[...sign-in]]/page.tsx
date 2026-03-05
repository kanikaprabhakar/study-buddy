"use client";

import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";

function clerkAppearance(dark: boolean) {
  return {
    variables: {
      colorPrimary:                   "#CB438B",
      colorBackground:                dark ? "#200B12" : "#FFF8EE",
      colorInputBackground:           dark ? "#2A0E15" : "#FFFFFF",
      colorInputText:                 dark ? "#FFE5D0" : "#4D3449",
      colorText:                      dark ? "#FFE5D0" : "#4D3449",
      colorTextSecondary:             dark ? "#C9A595" : "#6C6A43",
      colorTextOnPrimaryBackground:   "#FFFFFF",
      colorNeutral:                   dark ? "#FFE5D0" : "#4D3449",
      borderRadius:                   "14px",
      fontFamily:                     "var(--font-dm-sans), system-ui, sans-serif",
      fontSize:                       "15px",
    },
    elements: {
      rootBox:                  "w-full",
      card:                     `shadow-2xl border backdrop-blur-xl ${
                                  dark
                                    ? "border-[rgba(203,67,139,0.30)] bg-[rgba(32,11,18,0.90)]"
                                    : "border-[rgba(203,67,139,0.18)] bg-[rgba(255,248,238,0.90)]"
                                }`,
      formButtonPrimary:        "bg-gradient-to-br from-[#CB438B] to-[#BF3556] hover:opacity-90 transition-opacity shadow-lg",
      footerActionLink:         "text-[#CB438B] hover:text-[#BF3556] font-semibold",
      dividerLine:              dark ? "bg-[rgba(203,67,139,0.25)]" : "bg-[rgba(203,67,139,0.15)]",
      dividerText:              dark ? "text-[#C9A595]" : "text-[#6C6A43]",
      socialButtonsBlockButton: `border rounded-xl hover:opacity-80 transition-opacity ${
                                  dark
                                    ? "border-[rgba(203,67,139,0.30)] bg-[#2A0E15] text-[#FFE5D0]"
                                    : "border-[rgba(203,67,139,0.20)] bg-white text-[#4D3449]"
                                }`,
      socialButtonsBlockButtonText: dark ? "!text-[#FFE5D0]" : "!text-[#4D3449]",
      socialButtonsProviderIcon:    "opacity-100",
    },
  };
}

const FLOATERS = [
  { src: "/images/20.png", w: 110, top: "5%",     left: "3%",   anim: "animate-float-slow",   delay: "0s" },
  { src: "/images/23.png", w: 95,  top: "10%",    right: "4%",  anim: "animate-float-medium", delay: "1.2s" },
  { src: "/images/11.png", w: 85,  bottom: "22%", left: "2%",   anim: "animate-float-fast",   delay: "0.6s" },
  { src: "/images/16.png", w: 100, bottom: "8%",  right: "3%",  anim: "animate-float-slow",   delay: "1.8s" },
  { src: "/images/9.png",  w: 80,  top: "45%",    left: "0%",   anim: "animate-float-medium", delay: "2.1s" },
  { src: "/images/13.png", w: 90,  top: "60%",    right: "1%",  anim: "animate-float-fast",   delay: "0.3s" },
] as const;



export default function SignInPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <main className="relative min-h-screen overflow-hidden animate-gradient-bg flex items-center justify-center px-4 py-24">

      {/* Blobs */}
      <div aria-hidden className="pointer-events-none fixed top-[-100px] left-[-100px] h-[420px] w-[420px] rounded-full blur-3xl opacity-30 animate-float-slow"  style={{ background: "#CB438B" }} />
      <div aria-hidden className="pointer-events-none fixed top-[30%] right-[-120px] h-[360px] w-[360px] rounded-full blur-3xl opacity-20 animate-float-medium" style={{ background: "#BF3556" }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[10%] left-[5%] h-[280px] w-[280px] rounded-full blur-3xl opacity-15 animate-float-fast"    style={{ background: "#6C6A43" }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[-80px] right-[10%] h-[380px] w-[380px] rounded-full blur-3xl opacity-25 animate-float-slow" style={{ background: "#4D3449" }} />

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
            opacity: 0.75,
            zIndex: 1,
          }}
        >
          <Image src={f.src} alt="" width={f.w} height={f.w} className="object-contain" />
        </span>
      ))}

      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 pt-5">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold backdrop-blur-xl transition-all hover:scale-105"
          style={{
            background:  dark ? "rgba(28,11,16,0.80)"    : "rgba(255,240,210,0.80)",
            borderColor: dark ? "rgba(203,67,139,0.35)"  : "rgba(203,67,139,0.25)",
            color:       dark ? "#FFE5D0" : "#4D3449",
          }}
        >
          <Image
            src={dark ? "/images/1.png" : "/images/5.png"}
            alt="Zenith"
            width={20}
            height={20}
            className="object-contain"
          />
          Zenith
        </Link>
        <ThemeToggle />
      </div>

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-5 animate-fade-up">
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold italic animate-shimmer">
            Welcome back.
          </h1>
          <p className="mt-1 text-sm text-fg-secondary">
            Your study space is waiting.
          </p>
        </div>

        <SignIn
          appearance={clerkAppearance(dark)}
          redirectUrl="/dashboard"
        />

        <p className="text-sm text-fg-secondary">
          No account?{" "}
          <Link href="/sign-up" className="font-bold" style={{ color: "#CB438B" }}>
            Sign up free →
          </Link>
        </p>
      </div>
    </main>
  );
}
