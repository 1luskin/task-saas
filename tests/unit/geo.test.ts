import { describe, expect, it } from "vitest";
import { distanceM, navLinks, withinGeofence } from "@/lib/geo";

describe("Geo", () => {
  it("Entfernung Alexanderplatz → Brandenburger Tor ≈ 2,6 km", () => {
    const d = distanceM({ lat: 52.5219, lng: 13.4132 }, { lat: 52.5163, lng: 13.3777 });
    expect(d).toBeGreaterThan(2400);
    expect(d).toBeLessThan(2700);
  });
  it("Geozone: innerhalb/außerhalb, GPS-Ungenauigkeit max. 100 m Zuschlag", () => {
    const obj = [{ lat: 52.5176, lng: 13.437 }];
    expect(withinGeofence({ lat: 52.5178, lng: 13.4366 }, obj, 200)).toBe(true);
    expect(withinGeofence({ lat: 52.5219, lng: 13.4132 }, obj, 200)).toBe(false);
    expect(withinGeofence({ lat: 52.5219, lng: 13.4132, acc: 5000 }, obj, 200)).toBe(false); // Zuschlag gedeckelt
    expect(withinGeofence({ lat: 0, lng: 0 }, [{ lat: null, lng: null }], 200)).toBe(true); // keine Objekte → erlaubt
  });
  it("Navigationslinks mit Zwischenstopps", () => {
    const l = navLinks(["A-Str. 1", "B-Str. 2", "C-Str. 3"])!;
    expect(l.google).toContain("destination=C-Str.%203");
    expect(l.google).toContain("waypoints=A-Str.%201%7CB-Str.%202");
    expect(l.apple).toContain("daddr=");
    expect(navLinks([])).toBeNull();
  });
});
