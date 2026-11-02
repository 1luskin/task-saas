import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";
import { DemoLogin } from "./demo-login";
import { isDemo } from "@/lib/demo/mode";

export const metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Nur interne Pfade erlauben (kein Open Redirect)
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <AuthShell>
      {isDemo() ? <DemoLogin /> : <LoginForm next={safeNext} />}
    </AuthShell>
  );
}
