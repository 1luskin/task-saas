import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { APP_NAME } from "@/config/app";

export const alt = `${APP_NAME} – Aufgaben, Zeiten und Löhne`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Vorschaubild für WhatsApp/Facebook/LinkedIn (dunkles Design, Geologica/Golos) */
export default async function OgImage() {
  const dir = path.join(process.cwd(), "assets", "fonts");
  const [display, text] = await Promise.all([readFile(path.join(dir, "Geologica-SemiBold.ttf")), readFile(path.join(dir, "GolosText-Regular.ttf"))]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#1E2125", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, color: "#ECEEF0", fontFamily: "Golos" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontFamily: "Geologica", fontSize: 44 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "#30353B", display: "flex", alignItems: "center", justifyContent: "center", color: "#9DB6CB", fontSize: 40 }}>{APP_NAME.slice(0, 1)}</div>
          {APP_NAME}
        </div>
        <div style={{ fontFamily: "Geologica", fontSize: 68, marginTop: 40, lineHeight: 1.1 }}>Aufgaben, Zeiten und Löhne.</div>
        <div style={{ fontFamily: "Geologica", fontSize: 68, color: "#9DB6CB" }}>In einer App.</div>
        <div style={{ fontSize: 30, marginTop: 36, color: "#C8CDD3" }}>14 Tage kostenlos · Server in Frankfurt · DSGVO-konform</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Geologica", data: display, weight: 600 }, { name: "Golos", data: text, weight: 400 }] },
  );
}
