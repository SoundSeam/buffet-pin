import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { isAllowedAdminEmail } from "@/lib/env";
import { db } from "@/lib/db";
import {
  roleHasAnyCapability,
  roleHasCapability,
  type StaffCapability,
} from "@/lib/staff-policy";

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
  const staff = await db.staffMember.findFirst({
    where: {
      isActive: true,
      OR: [
        { authUserId: user!.id },
        ...(user!.email ? [{ email: user!.email.toLowerCase() }] : []),
      ],
      role: "MANAGER",
    },
  });
  return staff ? user : null;
}

export async function getStaffRole() {
  const user = await getSupabaseUser();

  if (!isAllowedAdminEmail(user?.email)) return null;

  const staff = await db.staffMember.findFirst({
    where: {
      isActive: true,
      OR: [
        { authUserId: user!.id },
        ...(user!.email ? [{ email: user!.email.toLowerCase() }] : []),
      ],
    },
    select: { role: true },
  });

  return staff?.role ?? null;
}

export async function getStaffUser(capability: StaffCapability) {
  const user = await getSupabaseUser();
  if (!isAllowedAdminEmail(user?.email)) return null;
  const staff = await db.staffMember.findFirst({
    where: {
      isActive: true,
      OR: [
        { authUserId: user!.id },
        ...(user!.email ? [{ email: user!.email.toLowerCase() }] : []),
      ],
    },
  });
  if (!staff || !roleHasCapability(staff.role, capability)) return null;
  if (!staff.authUserId) {
    await db.staffMember.update({
      where: { id: staff.id },
      data: { authUserId: user!.id },
    });
  }
  return { user: user!, staff };
}

export async function getStaffUserWithAnyCapability(
  capabilities: readonly StaffCapability[],
) {
  const user = await getSupabaseUser();
  if (!isAllowedAdminEmail(user?.email)) return null;
  const staff = await db.staffMember.findFirst({
    where: {
      isActive: true,
      OR: [
        { authUserId: user!.id },
        ...(user!.email ? [{ email: user!.email.toLowerCase() }] : []),
      ],
    },
  });
  if (!staff || !roleHasAnyCapability(staff.role, capabilities)) return null;
  if (!staff.authUserId) {
    await db.staffMember.update({
      where: { id: staff.id },
      data: { authUserId: user!.id },
    });
  }
  return { user: user!, staff };
}

export async function requireAdminUser(): Promise<User> {
  const user = await getAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return user;
}

export async function requireStaffUser(capability: StaffCapability) {
  const actor = await getStaffUser(capability);
  if (!actor) redirect("/admin/login");
  return actor;
}

export async function requireStaffUserWithAnyCapability(
  capabilities: readonly StaffCapability[],
) {
  const actor = await getStaffUserWithAnyCapability(capabilities);
  if (!actor) redirect("/admin/login");
  return actor;
}
