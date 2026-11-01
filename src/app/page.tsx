import { redirect } from "next/navigation";
import { getContext } from "@/lib/auth";

export default async function Home() {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  if (!ctx.member) redirect("/onboarding");
  redirect(ctx.member.role === "boss" ? "/boss" : "/staff/today");
}
