import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getContext } from "@/lib/auth";
import { OnboardingForm } from "./form";
import { LogoutButton } from "@/components/logout-button";

export default async function OnboardingPage() {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  if (ctx.member) redirect("/");
  return (
    <AuthShell>
      <OnboardingForm />
      <div className="mt-4 border-t border-line pt-4">
        <LogoutButton />
      </div>
    </AuthShell>
  );
}
