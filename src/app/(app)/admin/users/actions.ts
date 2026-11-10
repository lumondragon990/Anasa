"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/auth";
import { ROLES } from "@/lib/permissions";
import type { ActionState } from "@/lib/validation/shared";

const roleSchema = z.object({ role: z.enum(ROLES), active: z.enum(["true", "false"]) });

export async function setUserRole(userId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("users.manage");
  const parsed = roleSchema.safeParse({ role: formData.get("role"), active: formData.get("active") });
  if (!parsed.success) return { ok: false, message: "Choose a valid role." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", {
    p_user_id: userId,
    p_role: parsed.data.role,
    p_active: parsed.data.active === "true",
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/users");
  return { ok: true, message: "Saved." };
}

const settingsSchema = z.object({
  business_timezone: z.string().trim().min(1).refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone"),
  allow_self_approval: z.enum(["true", "false"]),
});

export async function saveSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireCapability("users.manage");
  const parsed = settingsSchema.safeParse({
    business_timezone: formData.get("business_timezone"),
    allow_self_approval: formData.get("allow_self_approval"),
  });
  if (!parsed.success) return { ok: false, message: z.flattenError(parsed.error).fieldErrors.business_timezone?.[0] ?? "Check the values." };
  const supabase = await createClient();
  const updates = [
    { key: "business_timezone", value: parsed.data.business_timezone },
    { key: "allow_self_approval", value: parsed.data.allow_self_approval === "true" },
  ];
  for (const u of updates) {
    const { error } = await supabase
      .from("application_settings")
      .update({ value: u.value, updated_by: user.id })
      .eq("key", u.key);
    if (error) return { ok: false, message: error.message };
  }
  revalidatePath("/admin/users");
  return { ok: true, message: "Settings saved." };
}
