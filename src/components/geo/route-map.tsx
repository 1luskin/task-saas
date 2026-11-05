"use client";
import dynamic from "next/dynamic";
import { useI18n } from "@/i18n/client";

const GeoMap = dynamic(() => import("./map").then((m) => m.GeoMap), { ssr: false, loading: () => <div className="skeleton h-72" /> });

export function RouteMap({ points }: { points: { lat: number; lng: number; label: string }[] }) {
  const { t } = useI18n();
  if (!points.length) return null;
  return <GeoMap points={points.map((p) => ({ ...p, tone: "stop" as const }))} line className="h-72" attribution={t("geo.attribution")} />;
}
