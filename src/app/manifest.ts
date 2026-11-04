import type { MetadataRoute } from "next";
import { APP_NAME } from "@/config/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${APP_NAME} – Aufgaben & Verdienst`,
    short_name: APP_NAME,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#E6E8EB",
    theme_color: "#E6E8EB",
    lang: "de",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
