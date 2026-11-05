"use client";
import { createContext, useContext, useState } from "react";
import type { GeoFix } from "@/lib/offline/queue";

type GeoState = { enabled: boolean; consent: boolean | null; setConsent: (v: boolean) => void; capture: () => Promise<GeoFix | null> };
const Ctx = createContext<GeoState>({ enabled: false, consent: null, setConsent: () => {}, capture: async () => null });

/** Standort nur im Moment der Aktion (Begonnen/Fertig/Schicht), nie im Hintergrund */
function getPosition(timeoutMs = 4000): Promise<GeoFix | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Number.isFinite(p.coords.accuracy) ? Math.round(p.coords.accuracy) : null }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

export function GeoProvider({ enabled, consent: initial, children }: { enabled: boolean; consent: boolean | null; children: React.ReactNode }) {
  const [consent, setConsent] = useState(initial);
  const capture = async () => (enabled && consent ? getPosition() : null);
  return <Ctx.Provider value={{ enabled, consent, setConsent, capture }}>{children}</Ctx.Provider>;
}

export const useGeo = () => useContext(Ctx);
