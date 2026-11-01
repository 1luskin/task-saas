import { StaffShell } from "@/components/shell/staff-shell";
import { requireStaffPage } from "@/lib/auth";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaffPage();
  return <StaffShell firmName={ctx.firm.name}>{children}</StaffShell>;
}
