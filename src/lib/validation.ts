import { z } from "zod";
import { parseMoneyToCents } from "./money";

export const uuid = z.string().uuid();
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const optText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional()).transform((v) => v ?? null);

export const isoDate = z.preprocess(
  emptyToNull,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
).transform((v) => v ?? null);

export const timeHHMM = z.preprocess(
  emptyToNull,
  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
).transform((v) => v ?? null);

export const optUuid = z.preprocess(emptyToNull, z.string().uuid().nullable().optional()).transform((v) => v ?? null);

/** Geldbetrag als Eingabe "12,50" → Cent */
export const moneyInput = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (typeof v === "number") return Math.round(v);
    const c = parseMoneyToCents(v ?? null);
    if (c !== null && Number.isNaN(c)) {
      ctx.addIssue({ code: "custom", message: "invalid amount" });
      return z.NEVER;
    }
    return c;
  })
  .refine((v) => v === null || (v >= 0 && v <= 100_000_000));

export const taskStatus = z.enum(["new", "in_progress", "review", "rework", "done"]);
export const priority = z.enum(["normal", "urgent"]);
export const memberStatus = z.enum(["active", "vacation", "sick"]);
export const payMode = z.enum(["hourly", "fixed", "both"]);
export const locale = z.enum(["de", "ru"]);
