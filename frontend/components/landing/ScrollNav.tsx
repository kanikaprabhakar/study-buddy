"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export function ScrollNav() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // appear after user scrolls past 90% of first viewport
      setShow(window.scrollY > window.innerHeight * 0.9);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 px-4 pt-3 sm:px-6"
      style={{
        transform: show ? "translateY(0)" : "translateY(-120%)",
        opacity: show ? 1 : 0,
        pointerEvents: show ? "auto" : "none",
        transition:
          "transform 0.55s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease",
      }}
    >
      <header
        className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border px-5 py-3 shadow-xl backdrop-blur-xl"
        style={{
          background: "rgba(255,240,210,0.80)",
          borderColor: "rgba(203,67,139,0.30)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Image src="/images/1.png" alt="Study Buddy" width={28} height={28} className="object-contain" />
          <span
            className="font-display text-lg font-bold italic"
            style={{ color: "#4D3449" }}
          >
            Study Buddy
          </span>
        </div>

        {/* Clerk-aware buttons */}
        <SignedIn>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg,#CB438B,#BF3556)",
              }}
            >
              Dashboard ↗
            </Link>
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                variables: {
                  colorPrimary: "#CB438B",
                  colorBackground: "#FFF0D2",
                  colorText: "#4D3449",
                  colorTextSecondary: "#6C6A43",
                  colorNeutral: "#4D3449",
                  borderRadius: "1rem",
                },
                elements: {
                  avatarBox: "ring-2 ring-[#CB438B] ring-offset-2 ring-offset-[#FFF0D2]",
                  userButtonPopoverCard: "border border-[rgba(203,67,139,0.25)] shadow-xl",
                  userButtonPopoverActions: "bg-[#FFF0D2]",
                },
              }}
            />
          </div>
        </SignedIn>

        <SignedOut>
          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="rounded-xl border px-4 py-2 text-sm font-bold transition-all duration-200 hover:scale-105"
              style={{ borderColor: "#CB438B", color: "#CB438B" }}
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-xl px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg,#CB438B,#BF3556)",
              }}
            >
              Get Started
            </Link>
          </div>
        </SignedOut>
      </header>
    </div>
  );
}
