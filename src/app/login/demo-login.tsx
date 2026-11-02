import { demoLogin, demoReset } from "@/server/actions/demo";
import { getI18n } from "@/i18n/server";
import { demoDb } from "@/lib/demo/fake-client";
import { Avatar } from "@/components/ui";

/** Demo-Modus: Rolle wählen statt E-Mail-Code */
export async function DemoLogin() {
  const { t } = await getI18n();
  const db = demoDb();
  const members = [...db.members].sort((a, b) => (a.role === b.role ? a.full_name.localeCompare(b.full_name) : a.role === "boss" ? -1 : 1));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("demo.title")}</h1>
        <p className="mt-1 text-muted">{t("demo.intro")}</p>
      </div>
      <div className="space-y-2">
        {members.map((m) => (
          <form key={m.id} action={demoLogin.bind(null, m.user_id!)}>
            <button className="flex min-h-16 w-full items-center gap-3 rounded-[16px] border border-line bg-card px-4 text-left transition hover:border-accent">
              <Avatar name={m.full_name} className="size-10 text-sm" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{m.full_name}</span>
                <span className="block text-sm text-muted">
                  {t(`role.${m.role}`)}
                  {m.status !== "active" && ` · ${t(`memberStatus.${m.status}`)}`}
                </span>
              </span>
              <span className="text-accent">→</span>
            </button>
          </form>
        ))}
      </div>
      <form action={demoReset}>
        <button className="btn-ghost w-full text-sm text-muted">{t("demo.reset")}</button>
      </form>
    </div>
  );
}
