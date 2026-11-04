"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { createInvite, revokeInvite } from "@/server/actions/members";
import { formatDate } from "@/lib/dates";
import { Select } from "../ui";
import { useAction, ErrorText } from "../use-action";

export function InvitePanel({
  firmName, appUrl, groups, invites,
}: { firmName: string; appUrl: string; groups: { id: string; name: string }[]; invites: { id: string; token: string; role: string; used_count: number; expires_at: string }[] }) {
  const { t, locale } = useI18n();
  const { run, pending, error } = useAction();
  const [role, setRole] = useState<"employee" | "boss">("employee");
  const [group, setGroup] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const url = (token: string) => `${appUrl}/join/${token}`;
  const wa = (token: string) => `https://wa.me/?text=${encodeURIComponent(t("employees.inviteMessage", { firm: firmName, url: url(token) }))}`;

  async function copy(token: string) {
    await navigator.clipboard.writeText(url(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="card-white space-y-3 p-4">
      <h2 className="font-semibold">{t("employees.inviteTitle")}</h2>
      <p className="text-sm text-muted">{t("employees.inviteHint")}</p>
      <div className="grid grid-cols-2 gap-2">
        <Select value={role} onChange={(e) => setRole(e.target.value as "employee" | "boss")}>
          <option value="employee">{t("role.employee")}</option>
          <option value="boss">{t("role.boss")}</option>
        </Select>
        <Select value={group} onChange={(e) => setGroup(e.target.value)} disabled={!groups.length}>
          <option value="">{t("employees.noGroup")}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
      </div>
      <button className="btn-primary w-full" disabled={pending} onClick={() => run(() => createInvite({ role, group_id: group || null }))}>
        {t("employees.createLink")}
      </button>
      <ErrorText error={error} />

      {invites.length > 0 && (
        <div className="space-y-2 border-t border-line/70 pt-3">
          <div className="text-sm font-medium text-muted">{t("employees.activeInvites")}</div>
          {invites.map((i) => (
            <div key={i.id} className="space-y-2 rounded-[14px] bg-card p-3">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{t(`role.${i.role as "boss" | "employee"}`)} · {i.used_count}× · ≤ {formatDate(i.expires_at.slice(0, 10), locale)}</span>
                <button className="hover:text-danger" onClick={() => run(() => revokeInvite(i.id))}>{t("employees.revoke")}</button>
              </div>
              <div className="truncate rounded-[10px] bg-surface px-2 py-1.5 font-mono text-xs">{url(i.token)}</div>
              <div className="grid grid-cols-2 gap-2">
                <a href={wa(i.token)} target="_blank" rel="noreferrer" className="btn-primary !min-h-11 text-sm">
                  {t("employees.shareWhatsApp")}
                </a>
                <button className="btn-secondary !min-h-11 text-sm" onClick={() => copy(i.token)}>
                  {copied === i.token ? t("common.copied") : t("common.copy")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
