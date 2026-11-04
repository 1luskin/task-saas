import { BossShell } from "@/components/shell/boss-shell";
import { requireBossPage } from "@/lib/auth";
import { pendingRequestCount } from "@/server/queries";

export default async function BossLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBossPage();
  const pending = await pendingRequestCount(ctx);
  return (
    <BossShell ctx={ctx} pendingRequests={pending}>
      {children}
    </BossShell>
  );
}
