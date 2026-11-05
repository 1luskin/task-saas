import { requireStaffPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { todayISO } from "@/lib/dates";
import { navLinks } from "@/lib/geo";
import { RouteMap } from "@/components/geo/route-map";
import { IconPin } from "@/components/icons";

/** Route für heute: Aufgaben nach Uhrzeit, Karte (wo Koordinaten bekannt) + Navigations-Links */
export default async function RoutePage() {
  const ctx = await requireStaffPage();
  const { t } = await getI18n();
  const { data } = await ctx.supabase
    .from("tasks")
    .select("id, title, address, due_time, lat, lng, status")
    .eq("assignee_id", ctx.member.id)
    .eq("due_date", todayISO())
    .neq("status", "done")
    .order("due_time", { nullsFirst: false });
  const tasks = data ?? [];
  const links = navLinks(tasks.map((x) => x.address ?? "").filter(Boolean));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("geo.route")}</h1>
      <p className="text-sm text-muted">{t("geo.routeHint")}</p>
      <RouteMap points={tasks.filter((x) => x.lat != null && x.lng != null).map((x, i) => ({ lat: x.lat!, lng: x.lng!, label: `${i + 1}. ${x.title}` }))} />
      <ol className="space-y-2">
        {tasks.map((x, i) => (
          <li key={x.id} className="card-white flex items-center gap-3 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 font-semibold tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{x.title}</div>
              <div className="flex items-center gap-1 text-sm text-muted"><IconPin className="size-4" />{x.address ?? "—"}{x.due_time ? ` · ${x.due_time.slice(0, 5)}` : ""}</div>
            </div>
          </li>
        ))}
      </ol>
      {links ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <a href={links.google} target="_blank" rel="noreferrer" className="btn-primary btn-xl">{t("geo.openGoogle")}</a>
          <a href={links.apple} target="_blank" rel="noreferrer" className="btn-secondary btn-xl">{t("geo.openApple")}</a>
        </div>
      ) : (
        <p className="text-muted">{t("geo.noAddress")}</p>
      )}
    </div>
  );
}
