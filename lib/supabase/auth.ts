import { redirect } from "next/navigation";
import type { Driver } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

import { db } from "@/lib/db";
import { isAllowedAdminEmail } from "@/lib/env";

import { createSupabaseServerClient } from "./server";

export async function getSupabaseUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
}

export async function getAdminUser(): Promise<User | null> {
  const user = await getSupabaseUser();

  if (!isAllowedAdminEmail(user?.email)) {
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

export type AuthenticatedDriver = {
  user: User;
  driver: Driver;
};

export async function getDriverUser(): Promise<AuthenticatedDriver | null> {
  const user = await getSupabaseUser();
  const email = user?.email?.trim();

  if (!user || !email) {
    return null;
  }

  const driver = await db.driver.findFirst({
    where: {
      isActive: true,
      OR: [
        { supabaseUserId: user.id },
        { email: { equals: email, mode: "insensitive" } },
      ],
    },
  });

  if (!driver) {
    return null;
  }

  if (!driver.supabaseUserId) {
    const linkedDriver = await db.driver.update({
      where: { id: driver.id },
      data: { supabaseUserId: user.id },
    });

    return { user, driver: linkedDriver };
  }

  return { user, driver };
}

export async function requireDriverUser(): Promise<AuthenticatedDriver> {
  const driverUser = await getDriverUser();

  if (!driverUser) {
    redirect("/driver");
  }

  return driverUser;
}
