"use client";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { submitInbound } from "@/server/actions/public";
import { Field, Input, Textarea } from "@/components/ui";
import { Turnstile } from "@/components/turnstile";

export function PublicForm({ slug, stamp, nonce }: { slug: string; stamp: string; nonce?: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [v, setV] = useState({ name: "", contact: "", address: "", message: "", website: "" });
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  if (state === "sent") return <div className="card-white p-5 text-ok">{t("pub.sent")}</div>;
  return (
    <form
      className="card-white space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await submitInbound(slug, { ...v, stamp, captcha });
          setState(r.ok ? "sent" : "error");
        });
      }}
    >
      <Field label={t("pub.name")}><Input required maxLength={160} autoComplete="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label={t("pub.contact")}><Input required maxLength={254} value={v.contact} onChange={(e) => setV({ ...v, contact: e.target.value })} /></Field>
      <Field label={t("pub.address")}><Input maxLength={300} autoComplete="street-address" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
      <Field label={t("pub.message")}><Textarea required maxLength={4000} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} /></Field>
      {/* Honeypot: für Menschen unsichtbar */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} /></label>
      </div>
      <Turnstile onToken={setCaptcha} nonce={nonce} />
      {state === "error" && <p className="text-sm text-danger" role="alert">{t("pub.error")}</p>}
      <button className="btn-primary btn-xl w-full" disabled={pending}>{t("pub.send")}</button>
    </form>
  );
}
