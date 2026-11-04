import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { APP_NAME } from "@/config/app";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Aufgaben & Verdienst für kleine Teams",
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#E6E8EB",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale}>
          {children}
          <ServiceWorkerRegister />
        </I18nProvider>
      </body>
    </html>
  );
}
