import type { Metadata, Viewport } from "next";
import { Geologica, Golos_Text } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/config/app";

const golos = Golos_Text({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], variable: "--font-golos", display: "swap" });
const geologica = Geologica({ subsets: ["latin", "cyrillic"], weight: ["500", "600", "700"], variable: "--font-geologica", display: "swap" });
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { CookieBanner } from "@/components/legal/cookie-banner";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Aufgaben & Verdienst für kleine Teams",
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "black-translucent",
    // iOS-Startbildschirm: dunkler Hintergrund mit Logo
    startupImage: [
      { url: "/icons/splash-750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/icons/splash-1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/icons/splash-1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/icons/splash-1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/icons/splash-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/icons/splash-1242x2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/icons/splash-1668x2388.png", media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/icons/splash-2048x2732.png", media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
    ],
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1E2125",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${golos.variable} ${geologica.variable}`}>
      <body>
        <I18nProvider locale={locale}>
          {children}
          <ServiceWorkerRegister />
          <CookieBanner />
        </I18nProvider>
      </body>
    </html>
  );
}
