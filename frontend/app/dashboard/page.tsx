import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Always fetch user so we have the first name
  const user = await currentUser();

  const backendUrl = process.env.BACKEND_URL;
  const syncSecret = process.env.BACKEND_INTERNAL_SYNC_SECRET;

  if (backendUrl && syncSecret && user) {
    try {
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
    } catch (error) {
      console.error("Dashboard backend sync failed:", error);
    }
  }

  // isNew = account created in the last 3 minutes → triggers welcome email once
  const isNew = user ? (Date.now() - user.createdAt) < 3 * 60 * 1000 : false;

  return <DashboardShell firstName={user?.firstName ?? null} lastName={user?.lastName ?? null} isNew={isNew} />;
}
