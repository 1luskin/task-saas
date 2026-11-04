import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";
import { DemoLogin } from "./demo-login";
import { isDemo } from "@/lib/demo/mode";
import { headers } from "next/headers";

export const metadata = { title: "Login", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Nur interne Pfade erlauben (kein Open Redirect)
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <AuthShell>
      {isDemo() ? <DemoLogin /> : <LoginForm next={safeNext} nonce={(await headers()).get("x-nonce") ?? undefined} />}
    </AuthShell>
  );
}
