/** Öffentliche URL des Firmenlogos (Bucket firm-logos ist öffentlich lesbar) */
export function logoUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/firm-logos/${path.split("/").map(encodeURIComponent).join("/")}`;
}
