/** Entfernung in Metern (Haversine) */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Geozone: Schicht nur in der Nähe eines Objekts starten. Ungenauigkeit des GPS wird
 * großzügig berücksichtigt (bis 100 m zusätzlich). Ohne Objekte mit Koordinaten → erlaubt.
 */
export function withinGeofence(
  pos: { lat: number; lng: number; acc?: number | null },
  targets: { lat: number | null; lng: number | null }[],
  radiusM: number,
): boolean {
  const pts = targets.filter((t): t is { lat: number; lng: number } => t.lat != null && t.lng != null);
  if (!pts.length) return true;
  const slack = Math.min(Math.max(pos.acc ?? 0, 0), 100);
  return pts.some((t) => distanceM(pos, t) <= radiusM + slack);
}

/** Navigationslinks (Google/Apple Maps) – Adressen reichen, keine Geokodierung nötig */
export function navLinks(stops: string[]): { google: string; apple: string } | null {
  const s = stops.filter(Boolean);
  if (!s.length) return null;
  const dest = s[s.length - 1]!;
  const way = s.slice(0, -1);
  const google = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${way.length ? `&waypoints=${encodeURIComponent(way.join("|"))}` : ""}&travelmode=driving`;
  const apple = `https://maps.apple.com/?daddr=${encodeURIComponent([...way, dest].join(" to: "))}&dirflg=d`;
  return { google, apple };
}
