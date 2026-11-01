import { BossShell } from "@/components/shell/boss-shell";
import { requireBossPage } from "@/lib/auth";
import { pendingRequestCount } from "@/server/queries";

export default async function BossLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBossPage();
  const pending = await pendingRequestCount(ctx);
  return (
    <BossShell firmName={ctx.firm.name} userName={ctx.member.full_name} pendingRequests={pending}>
      {children}
    </BossShell>
  );
}
