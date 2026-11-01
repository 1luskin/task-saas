"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { createGroup, deleteGroup } from "@/server/actions/members";
import { useAction, ErrorText } from "../use-action";
import { IconTrash } from "../icons";

export function GroupsPanel({ groups }: { groups: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [name, setName] = useState("");
  return (
    <div className="card-white space-y-3 p-4">
      <h2 className="font-semibold">{t("employees.groups")}</h2>
      <ul className="space-y-1">
        {groups.map((g) => (
          <li key={g.id} className="flex min-h-11 items-center justify-between rounded-[12px] bg-card px-3">
            <span>{g.name}</span>
            <button className="p-2 text-muted hover:text-danger" onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteGroup(g.id))} aria-label={t("common.delete")}>
              <IconTrash className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run(() => createGroup(name), { onOk: () => setName("") }); }}>
        <input className="input" placeholder={t("employees.groupName")} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <button className="btn-secondary" disabled={pending}>+</button>
      </form>
      <ErrorText error={error} />
    </div>
  );
}
