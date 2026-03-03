import { UserButton } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

type CardProps = {
  title: string;
  children: React.ReactNode;
};

function DashboardCard({ title, children }: CardProps) {
  return (
    <section className="rounded-2xl border border-violet-100 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-violet-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TaskItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-violet-50/70 px-4 py-3 text-sm text-violet-900">
      <span className="h-2.5 w-2.5 rounded-full bg-violet-300" aria-hidden />
      <span>{text}</span>
    </li>
  );
}

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const backendUrl = process.env.BACKEND_URL;
  const syncSecret = process.env.BACKEND_INTERNAL_SYNC_SECRET;

  if (backendUrl && syncSecret) {
    try {
      const user = await currentUser();

      if (user) {
        await fetch(`${backendUrl}/api/internal/sync-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sync-secret": syncSecret,
          },
          body: JSON.stringify({
            user: {
              id: user.id,
              first_name: user.firstName,
              last_name: user.lastName,
              username: user.username,
              primary_email_address_id: user.primaryEmailAddressId,
              email_addresses: user.emailAddresses.map((email) => ({
                id: email.id,
                email_address: email.emailAddress,
              })),
            },
          }),
          cache: "no-store",
        });
      }
    } catch (error) {
      console.error("Dashboard backend sync failed:", error);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 via-rose-50 to-sky-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex items-center justify-between rounded-2xl border border-violet-100 bg-white/80 px-5 py-4 shadow-sm backdrop-blur-sm sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight text-violet-950 sm:text-3xl">
            Study Buddy
          </h1>
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
                avatarBox: "ring-2 ring-[#CB438B] ring-offset-2 ring-offset-white",
                userButtonPopoverCard: "border border-[rgba(203,67,139,0.25)] shadow-xl",
                userButtonPopoverActions: "bg-[#FFF0D2]",
              },
            }}
          />
        </header>

        <section className="grid gap-5 md:grid-cols-2">
          <DashboardCard title="Today’s Plan">
            <ul className="space-y-3">
              <TaskItem text="DSA Learning: Arrays" />
              <TaskItem text="Revision: Binary Search" />
              <TaskItem text="Pomodoro Focus Session" />
            </ul>
          </DashboardCard>

          <DashboardCard title="Pomodoro Quick Start">
            <p className="text-sm text-violet-700">25 min focus / 5 min break</p>
            <button
              type="button"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Start Focus Session
            </button>
          </DashboardCard>

          <DashboardCard title="Motivation">
            <blockquote className="rounded-xl bg-rose-50/80 p-4 text-base leading-relaxed text-rose-900">
              “Small progress is still progress.”
            </blockquote>
          </DashboardCard>

          <DashboardCard title="Weekly Progress Preview">
            <div className="space-y-3">
              <div
                className="h-3 w-full overflow-hidden rounded-full bg-violet-100"
                role="progressbar"
                aria-label="Weekly study progress"
                aria-valuenow={40}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full w-2/5 rounded-full bg-violet-500" />
              </div>
              <p className="text-sm text-violet-700">2/5 study days completed</p>
            </div>
          </DashboardCard>
        </section>
      </div>
    </main>
  );
}
