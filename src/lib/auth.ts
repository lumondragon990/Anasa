import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, isInternal, type AppRole, type Capability } from "@/lib/permissions";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  isActive: boolean;
};

/** The signed-in user and profile, cached for the duration of one request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? profile?.email ?? "",
    fullName: profile?.full_name ?? null,
    role: (profile?.role as AppRole) ?? "pending",
    isActive: profile?.is_active ?? false,
  };
});

/** Use in internal pages: redirects to login or the waiting screen. */
export async function requireInternalUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isActive || !isInternal(user.role)) redirect("/pending");
  return user;
}

/** Use in Server Actions before a privileged operation. */
export async function requireCapability(capability: Capability) {
  const user = await requireInternalUser();
  if (!can(user.role, capability)) {
    throw new Error("You do not have permission to do this.");
  }
  return user;
}
