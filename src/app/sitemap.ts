import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  const page = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority,
    alternates: { languages: { de: `${base}${path}${path.includes("?") ? "&" : "?"}lang=de`, ru: `${base}${path}${path.includes("?") ? "&" : "?"}lang=ru` } },
  });
  return [page("/", 1), page("/impressum", 0.2), page("/datenschutz", 0.2), page("/agb", 0.2), page("/avv", 0.2)];
}
