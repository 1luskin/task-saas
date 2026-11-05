"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { assertBoss, assertWritable } from "@/lib/auth";
import { assertFeature } from "@/lib/features";
import { ActionError, check, must, runAction } from "@/lib/action";
import { isoDate, optText, uuid } from "@/lib/validation";
import { parseMoneyToCents } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { hit } from "@/lib/rate-limit";
import { isDemo } from "@/lib/demo/mode";
import { layout, sendEmail } from "@/lib/email";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { buildXRechnung } from "@/lib/xrechnung";
import { invoicePdf, offerPdf, sellerFromFirm } from "@/server/invoice-pdf";
import { notifyBosses } from "@/server/notify";

async function boss() {
  const ctx = await assertBoss();
  await assertFeature(ctx, "invoices");
  return ctx;
}
const refresh = (id?: string) => {
  revalidatePath("/boss/invoices");
  if (id) revalidatePath(`/boss/invoices/${id}`);
};

const itemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  qty: z.string().max(20),
  unit: z.string().trim().min(1).max(20),
  price: z.string().max(20),
  vat: z.union([z.literal(0), z.literal(7), z.literal(19)]),
});
type ItemInput = z.input<typeof itemSchema>;
function parseItems(items: ItemInput[]) {
  return z.array(itemSchema).max(100).parse(items).map((i, position) => {
    const qty = Number(i.qty.replace(",", "."));
    const price = parseMoneyToCents(i.price);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1000000 || price === null || !Number.isFinite(price) || price > 100000000) throw new ActionError("invalid");
    return { position, description: i.description, qty, unit: i.unit, unit_price_cents: price, vat_rate: i.vat };
  });
}
const hintError = (e: { hint?: string; message?: string }) => {
  const h = e.hint ?? "";
  if (["seller_incomplete", "buyer_incomplete", "service_date", "no_items", "invoice_locked", "cannot_cancel", "offer_closed", "name_required"].includes(h)) return new ActionError("invalid", h);
  return e;
};

// --- Rechnungen ---------------------------------------------------------------
export async function createInvoice(raw: { taskId?: string | null; clientId?: string | null; offerId?: string | null }) {
  return runAction(async () => {
    const ctx = await boss();
    assertWritable(ctx);
    const today = todayISO();
    let row: Record<string, unknown> = { service_date: today };
    let items: { description: string; qty: number; unit: string; unit_price_cents: number; vat_rate: 0 | 7 | 19; position: number }[] = [];
    const vat = (ctx.firm.small_business ? 0 : ctx.firm.vat_rate) as 0 | 7 | 19;
    let clientId = raw.clientId ? uuid.parse(raw.clientId) : null;
    if (raw.taskId) {
      const t = must(await ctx.supabase.from("tasks").select("*").eq("id", uuid.parse(raw.taskId)).eq("firm_id", ctx.firm.id).maybeSingle());
      const { data: fin } = await ctx.supabase.from("task_finance").select("client_price_cents").eq("task_id", t.id).maybeSingle();
      clientId = clientId ?? t.client_id;
      row = { ...row, task_id: t.id, service_date: (t.accepted_at ?? t.completed_at ?? today).slice(0, 10) };
      items = [{ position: 0, description: t.title, qty: 1, unit: "Pausch.", unit_price_cents: fin?.client_price_cents ?? 0, vat_rate: vat }];
    }
    if (raw.offerId) {
      const o = must(await ctx.supabase.from("offers").select("*").eq("id", uuid.parse(raw.offerId)).eq("firm_id", ctx.firm.id).maybeSingle());
      const { data: oi } = await ctx.supabase.from("offer_items").select("*").eq("offer_id", o.id).order("position");
      clientId = clientId ?? o.client_id;
      row = { ...row, offer_id: o.id, task_id: o.task_id, buyer_name: o.buyer_name, buyer_email: o.buyer_email };
      items = (oi ?? []).map((i) => ({ position: i.position, description: i.description, qty: Number(i.qty), unit: i.unit, unit_price_cents: i.unit_price_cents, vat_rate: i.vat_rate }));
    }
    if (clientId) {
      const { data: c } = await ctx.supabase.from("clients").select("*").eq("id", clientId).eq("firm_id", ctx.firm.id).maybeSingle();
      if (c) row = { ...row, client_id: c.id, buyer_name: c.name, buyer_street: c.street, buyer_zip: c.zip, buyer_city: c.city, buyer_country: c.country, buyer_vat_id: c.vat_id, buyer_email: c.email };
    }
    const inv = must(await ctx.supabase.from("invoices").insert({ ...row, firm_id: ctx.firm.id, created_by: ctx.member.id }).select("id").single());
    if (items.length) check(await ctx.supabase.from("invoice_items").insert(items.map((i) => ({ ...i, invoice_id: inv.id }))));
    refresh();
    return { id: inv.id };
  });
}

const draftSchema = z.object({
  buyer_name: z.string().trim().max(160),
  buyer_street: optText(160), buyer_zip: optText(10), buyer_city: optText(80),
  buyer_country: z.string().regex(/^[A-Z]{2}$/).default("DE"),
  buyer_vat_id: optText(20), buyer_email: optText(254), buyer_reference: optText(100),
  service_date: isoDate, service_date_to: isoDate, issue_date: isoDate, due_date: isoDate,
  note: optText(2000),
});
export async function saveInvoiceDraft(id: string, raw: z.input<typeof draftSchema> & { items: ItemInput[] }) {
  return runAction(async () => {
    const ctx = await boss();
    const invId = uuid.parse(id);
    const head = draftSchema.parse(raw);
    const items = parseItems(raw.items);
    const inv = must(await ctx.supabase.from("invoices").select("id,status").eq("id", invId).eq("firm_id", ctx.firm.id).maybeSingle());
    if (inv.status !== "draft") throw new ActionError("invalid", "invoice_locked");
    check(await ctx.supabase.from("invoices").update(head).eq("id", invId));
    check(await ctx.supabase.from("invoice_items").delete().eq("invoice_id", invId));
    if (items.length) check(await ctx.supabase.from("invoice_items").insert(items.map((i) => ({ ...i, invoice_id: invId }))));
    refresh(invId);
  });
}

export async function deleteInvoiceDraft(id: string) {
  return runAction(async () => {
    const ctx = await boss();
    check(await ctx.supabase.from("invoices").delete().eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id).eq("status", "draft"));
    refresh();
  });
}

/** Ausstellen: Nummer + Unveränderlichkeit (GoBD) */
export async function issueInvoice(id: string) {
  return runAction(async () => {
    const ctx = await boss();
    const { data, error } = await ctx.supabase.rpc("issue_invoice", { p_invoice: uuid.parse(id) });
    if (error) throw hintError(error);
    refresh(id);
    return { number: data };
  });
}

export async function setInvoicePaid(id: string, paid: boolean) {
  return runAction(async () => {
    const ctx = await boss();
    check(await ctx.supabase.from("invoices").update({ status: paid ? "paid" : "sent" }).eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id).in("status", ["sent", "paid"]));
    refresh(id);
  });
}

export async function cancelInvoice(id: string, reason: string) {
  return runAction(async () => {
    const ctx = await boss();
    const { data, error } = await ctx.supabase.rpc("cancel_invoice", { p_invoice: uuid.parse(id), p_reason: z.string().trim().max(500).parse(reason) || null });
    if (error) throw hintError(error);
    refresh(id);
    return { id: data };
  });
}

/** Rechnung (PDF + XRechnung) per E-Mail an den Kunden */
export async function emailInvoice(id: string) {
  return runAction(async () => {
    const ctx = await boss();
    const inv = must(await ctx.supabase.from("invoices").select("*").eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id).maybeSingle());
    if (inv.status === "draft" || !inv.buyer_email) throw new ActionError("invalid");
    if (!(await hit("publicForm", `invoice-mail:${ctx.userId}`))) throw new ActionError("forbidden", "rate_limited");
    const { data: items } = await ctx.supabase.from("invoice_items").select("*").eq("invoice_id", inv.id).order("position");
    const { data: orig } = inv.cancels_id ? await ctx.supabase.from("invoices").select("number").eq("id", inv.cancels_id).maybeSingle() : { data: null };
    const pdf = await invoicePdf(inv, items ?? [], inv.seller, orig?.number);
    const xml = new TextEncoder().encode(buildXRechnung(inv, items ?? [], orig?.number));
    const title = `${inv.kind === "storno" ? "Stornorechnung" : "Rechnung"} ${inv.number} – ${inv.seller.name ?? ctx.firm.name}`;
    const m = layout({ title, lines: [`Guten Tag,`, `anbei erhalten Sie unsere ${inv.kind === "storno" ? "Stornorechnung" : "Rechnung"} ${inv.number} als PDF und als XRechnung (XML).`], footer: inv.seller.name ?? ctx.firm.name });
    if (!isDemo()) {
      await sendEmail({ to: inv.buyer_email, subject: title, ...m, replyTo: inv.seller.email ?? undefined,
        attachments: [{ name: `${inv.number}.pdf`, content: pdf }, { name: `${inv.number}.xml`, content: xml }] });
    }
  });
}

// --- Angebote -----------------------------------------------------------------
export async function createOffer(raw: { clientId?: string | null }) {
  return runAction(async () => {
    const ctx = await boss();
    assertWritable(ctx);
    let row: Record<string, unknown> = { title: "Angebot" };
    if (raw.clientId) {
      const { data: c } = await ctx.supabase.from("clients").select("*").eq("id", uuid.parse(raw.clientId)).eq("firm_id", ctx.firm.id).maybeSingle();
      if (c) row = { ...row, client_id: c.id, buyer_name: c.name, buyer_email: c.email, buyer_address: c.address };
    }
    const o = must(await ctx.supabase.from("offers").insert({ ...row, firm_id: ctx.firm.id, created_by: ctx.member.id } as never).select("id").single());
    refresh();
    return { id: o.id };
  });
}

const offerSchema = z.object({
  title: z.string().trim().min(1).max(200), intro: optText(3000), buyer_name: z.string().trim().max(160),
  buyer_email: optText(254), buyer_address: optText(300), valid_until: isoDate,
});
export async function saveOfferDraft(id: string, raw: z.input<typeof offerSchema> & { items: ItemInput[] }) {
  return runAction(async () => {
    const ctx = await boss();
    const offId = uuid.parse(id);
    const head = offerSchema.parse(raw);
    const items = parseItems(raw.items);
    const o = must(await ctx.supabase.from("offers").select("id,status").eq("id", offId).eq("firm_id", ctx.firm.id).maybeSingle());
    if (o.status !== "draft") throw new ActionError("invalid", "invoice_locked");
    check(await ctx.supabase.from("offers").update({ ...head, updated_at: new Date().toISOString() }).eq("id", offId));
    check(await ctx.supabase.from("offer_items").delete().eq("offer_id", offId));
    if (items.length) check(await ctx.supabase.from("offer_items").insert(items.map((i) => ({ ...i, offer_id: offId }))));
    refresh(offId);
  });
}

export async function deleteOffer(id: string) {
  return runAction(async () => {
    const ctx = await boss();
    check(await ctx.supabase.from("offers").delete().eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id).in("status", ["draft", "declined"]));
    refresh();
  });
}

/** Versenden: Nummer vergeben; mit E-Mail des Kunden → Link + PDF per Mail */
export async function sendOffer(id: string) {
  return runAction(async () => {
    const ctx = await boss();
    const { error } = await ctx.supabase.rpc("send_offer", { p_offer: uuid.parse(id) });
    if (error) throw hintError(error);
    const o = must(await ctx.supabase.from("offers").select("*").eq("id", id).maybeSingle());
    const url = `${serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/o/${o.token}`;
    if (o.buyer_email && !isDemo() && (await hit("publicForm", `offer-mail:${ctx.userId}`))) {
      const { data: items } = await ctx.supabase.from("offer_items").select("*").eq("offer_id", o.id).order("position");
      const pdf = await offerPdf(o, items ?? [], sellerFromFirm(ctx.firm));
      const firmName = ctx.firm.legal_name || ctx.firm.name;
      const m = layout({ title: `Angebot ${o.number} – ${firmName}`, lines: ["Guten Tag,", `anbei unser Angebot „${o.title}“. Sie können es online ansehen und mit einem Klick annehmen.`], cta: { label: "Angebot ansehen", url }, footer: firmName });
      after(() => sendEmail({ to: o.buyer_email!, subject: `Angebot ${o.number} – ${firmName}`, ...m, replyTo: ctx.firm.invoice_email ?? undefined, attachments: [{ name: `${o.number}.pdf`, content: pdf }] }).then(() => undefined));
    }
    refresh(id);
    return { url };
  });
}

/** Öffentlich: Kunde nimmt Angebot an / lehnt ab (Token = Geheimnis; Rate-Limit) */
export async function decideOfferPublic(token: string, accept: boolean, name: string) {
  return runAction(async () => {
    if (!/^[0-9a-f]{20,128}$/i.test(token)) throw new ActionError("invalid");
    if (!(await hit("publicLink", `offer:${token.slice(0, 16)}`))) throw new ActionError("forbidden", "rate_limited");
    const admin = createAdminClient();
    const { data: o } = await admin.from("offers").select("id, firm_id, title, number").eq("token", token).maybeSingle();
    if (!o) throw new ActionError("invalid");
    const { error } = await admin.rpc("decide_offer", { p_token: token, p_accept: accept, p_name: z.string().trim().max(120).parse(name) });
    if (error) throw hintError(error);
    after(() => notifyBosses(o.firm_id, (t) => ({ title: accept ? t("inv.offerAcceptedPush") : t("inv.offerDeclinedPush"), body: `${o.number}: ${o.title}`, url: `/boss/offers/${o.id}`, tag: `offer-${o.id}` }), "client_accepted"));
    revalidatePath(`/o/${token}`);
  });
}

// --- Rechnungsdaten der Firma ---------------------------------------------------
const sellerSchema = z.object({
  legal_name: optText(160), address_street: optText(160),
  address_zip: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^[0-9A-Za-z -]{3,10}$/).nullable()),
  address_city: optText(80), address_country: z.string().regex(/^[A-Z]{2}$/),
  tax_number: optText(40),
  vat_id: z.preprocess((v) => (typeof v === "string" ? v.replace(/\s/g, "").toUpperCase() || null : v), z.string().regex(/^[A-Z]{2}[0-9A-Za-z+*.]{2,12}$/).nullable()),
  iban: z.preprocess((v) => (typeof v === "string" ? v.replace(/\s/g, "").toUpperCase() || null : v), z.string().regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/).nullable()),
  bic: z.preprocess((v) => (typeof v === "string" ? v.replace(/\s/g, "").toUpperCase() || null : v), z.string().regex(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/).nullable()),
  bank_name: optText(80), invoice_email: optText(254), invoice_phone: optText(40),
  invoice_prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,8}$/),
  payment_terms_days: z.number().int().min(0).max(120),
});
export async function saveSellerData(raw: z.input<typeof sellerSchema>) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("firms").update(sellerSchema.parse(raw)).eq("id", ctx.firm.id));
    revalidatePath("/boss/settings");
    revalidatePath("/boss/invoices", "layout");
  });
}
