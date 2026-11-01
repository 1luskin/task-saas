import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Nur interne Pfade erlauben (kein Open Redirect)
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <AuthShell>
      <LoginForm next={safeNext} />
    </AuthShell>
  );
}
