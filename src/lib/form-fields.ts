import type { FormField } from "./supabase/types";

const TYPES = ["text", "number", "checkbox", "select", "photo"] as const;

/** "typ;Bezeichnung;Option1|Option2" je Zeile → Felder. Fehlerhafte Zeilen → Zeilennummern. */
export function parseFormFields(src: string): { fields: FormField[]; errors: number[] } {
  const fields: FormField[] = [];
  const errors: number[] = [];
  src.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const [typeRaw, labelRaw, optsRaw] = line.split(";").map((x) => x.trim());
    const type = (typeRaw ?? "").toLowerCase() as FormField["type"];
    const label = labelRaw ?? "";
    if (!TYPES.includes(type) || !label || label.length > 120) return errors.push(i + 1);
    const options = type === "select" ? (optsRaw ?? "").split("|").map((o) => o.trim()).filter(Boolean).slice(0, 20) : undefined;
    if (type === "select" && !options?.length) return errors.push(i + 1);
    fields.push({ id: `f${fields.length + 1}`, type, label, ...(options ? { options } : {}) });
  });
  return { fields, errors };
}

export function fieldsToText(fields: FormField[]): string {
  return fields.map((f) => [f.type, f.label, f.options?.join("|")].filter((x) => x !== undefined).join(";")).join("\n");
}
