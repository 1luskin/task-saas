import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Werkplan – Aufgaben & Verdienst",
    short_name: "Werkplan",
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
