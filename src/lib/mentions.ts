/** Findet @Vorname bzw. @Vorname Nachname im Text (Groß/klein egal). Gibt IDs der passenden Personen zurück. */
export function parseMentions(body: string, people: { id: string; full_name: string }[]): string[] {
  const text = body.toLowerCase();
  const out = new Set<string>();
  for (const p of people) {
    const full = p.full_name.toLowerCase();
    const first = full.split(/\s+/)[0] ?? "";
    if (text.includes(`@${full}`) || (first.length >= 2 && new RegExp(`@${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(text))) out.add(p.id);
  }
  return [...out];
}
