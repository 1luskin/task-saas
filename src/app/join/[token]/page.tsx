import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { getContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";
import { JoinForm } from "./form";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t } = await getI18n();
  const valid = /^[0-9a-f]{20,64}$/.test(token);
  const supabase = await createClient();
  const info = valid ? (await supabase.rpc("invite_info", { p_token: token })).data?.[0] : undefined;
  const ctx = await getContext();

  if (!info || !info.valid) {
    return (
      <AuthShell>
        <p className="text-center">{t("join.invalid")}</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("join.title")}</h1>
          <p className="mt-1">{t("join.invitedTo", { firm: info.firm_name })}</p>
          <p className="text-sm text-muted">{info.role === "boss" ? t("join.asBoss") : t("join.asEmployee")}</p>
        </div>
        {!ctx ? (
          <>
            <p className="text-muted">{t("join.loginFirst")}</p>
            <Link href={`/login?next=${encodeURIComponent(`/join/${token}`)}`} className="btn-primary btn-xl w-full">
              {t("auth.loginTitle")}
            </Link>
          </>
        ) : ctx.member ? (
          <>
            <p className="text-muted">{t("join.alreadyMember")}</p>
            <Link href="/" className="btn-secondary w-full">
              OK
            </Link>
          </>
        ) : (
          <JoinForm token={token} />
        )}
      </div>
    </AuthShell>
  );
}
