"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEMO_COOKIE, isDemo } from "@/lib/demo/mode";
import { demoDb, resetDemoDb } from "@/lib/demo/fake-client";

/** Im Demo-Modus als beliebige Testperson anmelden */
export async function demoLogin(userId: string) {
  if (!isDemo()) throw new Error("not in demo mode");
  const uid = z.string().uuid().parse(userId);
  if (!demoDb().users.some((u) => u.id === uid)) throw new Error("unknown demo user");
  (await cookies()).set(DEMO_COOKIE, uid, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 });
  redirect("/");
}

export async function demoReset() {
  if (!isDemo()) throw new Error("not in demo mode");
  resetDemoDb();
  redirect("/login");
}
