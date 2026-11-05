"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type * as L from "leaflet";

export type MapPoint = { lat: number; lng: number; label: string; tone?: "object" | "start" | "finish" | "stop" };
const COLORS = { object: "#9DB6CB", start: "#A9C9B4", finish: "#E2C98F", stop: "#7E9BB3" } as const;

/** Leaflet + OpenStreetMap (Tile-Server per env). Marker als Kreise – keine Bilddateien nötig. */
export function GeoMap({ points, line = false, onPick, className = "h-64", attribution }: { points: MapPoint[]; line?: boolean; onPick?: (lat: number, lng: number) => void; className?: string; attribution: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Lf = await import("leaflet");
      if (cancelled || !el.current || map.current) return;
      const m = Lf.map(el.current, { zoomControl: true, attributionControl: true }).setView([52.52, 13.405], 11);
      Lf.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution }).addTo(m);
      m.on("click", (e: L.LeafletMouseEvent) => pick.current?.(e.latlng.lat, e.latlng.lng));
      map.current = m;
      layer.current = Lf.layerGroup().addTo(m);
      draw(Lf);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw(Lf: typeof L) {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    for (const p of pts) {
      Lf.circleMarker([p.lat, p.lng], { radius: 9, color: "#1E2125", weight: 2, fillColor: COLORS[p.tone ?? "stop"], fillOpacity: 1 }).bindTooltip(p.label).addTo(layer.current);
    }
    if (line && pts.length > 1) Lf.polyline(pts.map((p) => [p.lat, p.lng] as [number, number]), { color: "#7E9BB3", weight: 3, opacity: 0.8 }).addTo(layer.current);
    if (pts.length === 1) map.current.setView([pts[0]!.lat, pts[0]!.lng], 15);
    else if (pts.length > 1) map.current.fitBounds(Lf.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), { padding: [24, 24] });
  }

  useEffect(() => {
    void import("leaflet").then((Lf) => draw(Lf));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, line]);

  return <div ref={el} className={`z-0 w-full overflow-hidden rounded-[14px] ${className}`} role="region" aria-label="Karte" />;
}
