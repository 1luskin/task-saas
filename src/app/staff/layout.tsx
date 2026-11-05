import { StaffShell } from "@/components/shell/staff-shell";
import { requireStaffPage } from "@/lib/auth";
import { isEnabled } from "@/lib/features";
import { GeoProvider } from "@/components/geo/geo-context";

export const metadata = { robots: { index: false, follow: false } };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaffPage();
  const geoOn = await isEnabled(ctx, "geolocation");
  const { data: c } = geoOn
    ? await ctx.supabase.from("consents").select("granted").eq("user_id", ctx.userId).eq("kind", "geolocation").order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  return (
    <GeoProvider enabled={geoOn} consent={c ? c.granted : null}>
      <StaffShell ctx={ctx}>{children}</StaffShell>
    </GeoProvider>
  );
}
