import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getI18n } from "@/i18n/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logoUrl } from "@/lib/logo";
import { formStamp } from "@/server/actions/public";
import { LegalFooter } from "@/components/legal/legal-footer";
import { PublicForm } from "./form";

export const dynamic = "force-dynamic";

/** Öffentliche Firmenseite mit Anfrageformular (nur wenn Funktion "public_form" aktiv) */
export default async function PublicFirmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) notFound();
  const { t } = await getI18n();
  const admin = createAdminClient();
  const { data: firm } = await admin.from("firms").select("id, name, logo_path").eq("public_slug", slug).maybeSingle();
  if (!firm) notFound();
  const [{ data: flag }, { data: ov }] = await Promise.all([
    admin.from("feature_flags").select("default_enabled").eq("key", "public_form").maybeSingle(),
    admin.from("firm_features").select("enabled").eq("firm_id", firm.id).eq("key", "public_form").maybeSingle(),
  ]);
  if (!(ov ? ov.enabled : flag?.default_enabled)) notFound();
  const logo = logoUrl(firm.logo_path);
  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-8">
      <header className="flex items-center gap-3">
        {logo ? <img src={logo} alt="" className="size-12 rounded-[12px] object-contain" /> : <span className="flex size-12 items-center justify-center rounded-[12px] bg-surface font-display text-lg font-semibold">{firm.name.slice(0, 1)}</span>}
        <h1 className="text-2xl font-semibold">{t("pub.title", { firm: firm.name })}</h1>
      </header>
      <p className="text-ink-2">{t("pub.intro")}</p>
      <PublicForm slug={slug} stamp={await formStamp()} nonce={(await headers()).get("x-nonce") ?? undefined} />
      <LegalFooter />
    </main>
  );
}
