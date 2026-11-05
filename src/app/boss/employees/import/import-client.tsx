"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { importMembers } from "@/server/actions/import";
import { useAction, ErrorText } from "@/components/use-action";
import { IconDownload } from "@/components/icons";

type Res = { valid: { row: number; full_name: string; email: string | null; group: string | null }[]; errors: { row: number; code: "name" | "email" | "dupe" | "rate" | "days" | "phone" }[]; created?: number; links?: { name: string; url: string }[] };

export function ImportClient() {
  const { t } = useI18n();
  const { run, pending, error, setError } = useAction();
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<Res | null>(null);

  function send(dry: boolean) {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    if (dry) fd.set("dry", "1");
    setRes(null);
    run(async () => {
      const r = await importMembers(fd);
      if (!r.ok && r.error === "invalid") setError(t("imp.badFile"));
      return r;
    }, { onOk: (r) => setRes(r.data as Res) });
  }

  return (
    <div className="space-y-4">
      <section className="card-white space-y-3 p-4">
        <h2 className="font-semibold">{t("imp.step1")}</h2>
        <p className="text-sm text-muted">{t("imp.hint")}</p>
        <a className="btn-secondary" href="/api/import/members-template"><IconDownload className="size-5" />{t("imp.template")}</a>
      </section>
      <section className="card-white space-y-3 p-4">
        <h2 className="font-semibold">{t("imp.step2")}</h2>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="block w-full text-sm"
          onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setRes(null); }} />
        <button className="btn-primary" disabled={!file || pending} onClick={() => send(true)}>{t("imp.preview")}</button>
        <ErrorText error={error} />
      </section>
      {res && res.created === undefined && (
        <section className="card-white space-y-3 p-4">
          <h2 className="font-semibold">{t("imp.preview")}</h2>
          {res.errors.length > 0 && (
            <div className="rounded-[12px] bg-danger-soft p-3 text-sm text-danger">
              <div className="font-medium">{t("imp.errors")}</div>
              <ul>{res.errors.map((e) => <li key={e.row}>{t("imp.row", { n: e.row })}: {t(`imp.e_${e.code}`)}</li>)}</ul>
            </div>
          )}
          <ul className="divide-y divide-line/60 text-sm">
            {res.valid.map((v) => <li key={v.row} className="flex gap-3 py-2"><span className="w-16 text-muted">{v.row}</span><span className="flex-1">{v.full_name}</span><span className="text-muted">{v.email ?? "—"}</span><span className="w-28 truncate text-muted">{v.group ?? ""}</span></li>)}
          </ul>
          {res.valid.length > 0 && <button className="btn-primary" disabled={pending} onClick={() => send(false)}>{t("imp.run", { n: res.valid.length })}</button>}
        </section>
      )}
      {res?.created !== undefined && (
        <section className="card-white space-y-3 p-4">
          <p className="text-ok">{t("imp.done", { n: res.created })}</p>
          {(res.links ?? []).length > 0 && (
            <div className="space-y-1 text-sm">
              <div className="text-muted">{t("imp.noEmail")}</div>
              {res.links!.map((l) => <div key={l.url} className="flex flex-wrap gap-2"><span className="font-medium">{l.name}</span><code className="break-all text-link">{l.url}</code></div>)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
