import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { isAllowedAdminEmail } from "@/lib/env";

import { createSupabaseServerClient } from "./server";

export async function getAdminUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !isAllowedAdminEmail(user?.email)) {
    return null;
  }

  return user;
}

export async function requireAdminUser(): Promise<User> {
  const user = await getAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return user;
}
