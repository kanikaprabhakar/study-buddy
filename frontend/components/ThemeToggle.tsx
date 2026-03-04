"use client";

import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center gap-[3px] rounded-2xl p-[5px] transition-all duration-300"
      style={{
        background: isDark ? "rgba(203,67,139,0.18)" : "rgba(203,67,139,0.10)",
        border: "1px solid rgba(203,67,139,0.28)",
      }}
    >
      {/* SUN */}
      <span
        className="flex items-center justify-center rounded-[10px] transition-all duration-300"
        style={{
          width: 32,
          height: 32,
          background: isDark ? "transparent" : "rgba(255,255,255,0.92)",
          boxShadow: isDark ? "none" : "0 1px 6px rgba(0,0,0,0.10)",
        }}
      >
        <SunIcon
          className="transition-all duration-300"
          style={{
            width: 17,
            height: 17,
            opacity: isDark ? 0.45 : 1,
            color: isDark ? "var(--fg-primary)" : "#4D3449",
          }}
        />
      </span>

      {/* MOON */}
      <span
        className="flex items-center justify-center rounded-[10px] transition-all duration-300"
        style={{
          width: 32,
          height: 32,
          background: isDark ? "rgba(255,255,255,0.92)" : "transparent",
          boxShadow: isDark ? "0 1px 6px rgba(0,0,0,0.18)" : "none",
        }}
      >
        <MoonIcon
          className="transition-all duration-300"
          style={{
            width: 17,
            height: 17,
            opacity: isDark ? 1 : 0.4,
            color: isDark ? "#4D3449" : "var(--fg-primary)",
          }}
        />
      </span>
    </button>
  );
}

function SunIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <circle cx="12" cy="12" r="4.5" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="6.64" y2="6.64" />
      <line x1="17.36" y1="17.36" x2="19.07" y2="19.07" />
      <line x1="4.93" y1="19.07" x2="6.64" y2="17.36" />
      <line x1="17.36" y1="6.64" x2="19.07" y2="4.93" />
    </svg>
  );
}

function MoonIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  );
}
