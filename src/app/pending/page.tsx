import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isInternal } from "@/lib/permissions";
import { signOut } from "@/app/(app)/actions";

export const metadata = { title: "Awaiting access" };
export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isActive && isInternal(user.role)) redirect("/");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="text-sm font-semibold tracking-[0.08em]">ANASA</p>
      <h1 className="mt-2 text-2xl font-semibold">Your account is waiting for a role</h1>
      <p className="mt-3 text-sm text-muted">
        You’re signed in as {user.email}. An administrator needs to assign your role before you can open Command
        Center. Ask them to look under Administration → Users.
      </p>
      <form action={signOut} className="mt-8">
        <button className="text-sm text-accent hover:underline" type="submit">
          Sign out
        </button>
      </form>
    </main>
  );
}
