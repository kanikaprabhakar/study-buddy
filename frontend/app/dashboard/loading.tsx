export default function DashboardLoading() {
  return (
    <div className="relative min-h-screen overflow-hidden animate-gradient-bg flex flex-col items-center justify-center">
      {/* Ambient blobs */}
      <div aria-hidden className="pointer-events-none fixed top-[-80px] left-[-80px] h-[340px] w-[340px] rounded-full blur-3xl opacity-25 animate-float-slow"   style={{ background: "#CB438B" }} />
      <div aria-hidden className="pointer-events-none fixed top-[35%] right-[-100px] h-[300px] w-[300px] rounded-full blur-3xl opacity-18 animate-float-medium" style={{ background: "#BF3556" }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[10%] left-[4%] h-[240px] w-[240px] rounded-full blur-3xl opacity-14 animate-float-fast"    style={{ background: "#6C6A43" }} />

      {/* Centre card */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Pulsing ring */}
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ background: "radial-gradient(circle, #CB438B 0%, transparent 70%)" }}
          />
          <span
            className="relative flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "linear-gradient(135deg,#CB438B,#BF3556)", boxShadow: "0 0 32px rgba(203,67,139,0.55)" }}
          >
            {/* Simple Z monogram */}
            <span className="font-display text-2xl font-bold italic text-white select-none">Z</span>
          </span>
        </div>

        <p
          className="text-sm font-bold uppercase tracking-[0.3em] animate-pulse"
          style={{ color: "#CB438B" }}
        >
          Loading your space…
        </p>

        {/* Skeleton cards */}
        <div className="mt-4 w-[min(420px,90vw)] space-y-3">
          {[80, 55, 70].map((w, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-2xl"
              style={{
                width: `${w}%`,
                background: "rgba(203,67,139,0.12)",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
