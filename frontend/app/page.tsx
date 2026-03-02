import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 via-rose-50 to-sky-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="animate-fade-up flex items-center justify-between rounded-2xl border border-violet-100 bg-white/80 px-5 py-4 shadow-sm backdrop-blur-sm sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet-500">
              Calm Study Planner
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-violet-950">
              Study Buddy
            </h1>
          </div>

          <SignedIn>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
              >
                Open Dashboard
              </Link>
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </SignedIn>

          <SignedOut>
            <div className="flex items-center gap-2">
              <Link
                href="/sign-in"
                className="rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-medium text-violet-900 transition hover:bg-violet-50"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
              >
                Get Started
              </Link>
            </div>
          </SignedOut>
        </header>

        <section className="animate-fade-up delay-100 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <article className="rounded-3xl border border-violet-100 bg-white/85 p-8 shadow-sm backdrop-blur-sm sm:p-10">
            <p className="text-sm font-medium text-violet-500">Built for focused days</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-violet-950 sm:text-5xl">
              Plan your sessions, keep momentum, and study with clarity.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-violet-800 sm:text-lg">
              Study Buddy gives you a peaceful dashboard for daily goals, quick
              Pomodoro sessions, and weekly progress so you can stay consistent without
              feeling overwhelmed.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/sign-up"
                className="rounded-xl border border-violet-200 bg-white px-5 py-3 text-sm font-semibold text-violet-900 transition hover:bg-violet-50"
              >
                Create Account
              </Link>
            </div>
          </article>

          <article className="rounded-3xl border border-violet-100 bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <h3 className="text-lg font-semibold text-violet-950">Today at a glance</h3>
            <ul className="mt-4 space-y-3 text-sm text-violet-900">
              <li className="rounded-xl bg-violet-50/80 px-4 py-3">📘 DSA Learning: Arrays</li>
              <li className="rounded-xl bg-violet-50/80 px-4 py-3">🧠 Revision: Binary Search</li>
              <li className="rounded-xl bg-violet-50/80 px-4 py-3">⏱️ Pomodoro Focus Session</li>
            </ul>
            <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
              “Small progress is still progress.”
            </p>
          </article>
        </section>

        <section className="animate-fade-up delay-200 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-violet-100 bg-white/80 p-5 shadow-sm">
            <p className="text-sm font-medium text-violet-500">Planner First</p>
            <p className="mt-2 text-sm text-violet-900">
              Keep daily tasks visible with a calm, minimal layout.
            </p>
          </article>
          <article className="rounded-2xl border border-violet-100 bg-white/80 p-5 shadow-sm">
            <p className="text-sm font-medium text-violet-500">Focus Timer</p>
            <p className="mt-2 text-sm text-violet-900">
              Start 25/5 sessions quickly whenever you’re ready.
            </p>
          </article>
          <article className="rounded-2xl border border-violet-100 bg-white/80 p-5 shadow-sm">
            <p className="text-sm font-medium text-violet-500">Weekly Momentum</p>
            <p className="mt-2 text-sm text-violet-900">
              Track consistency and build a steady study rhythm.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
