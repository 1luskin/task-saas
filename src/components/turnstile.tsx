"use client";
import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; theme?: string }) => string };
  }
}

/** Cloudflare Turnstile – nur sichtbar, wenn NEXT_PUBLIC_TURNSTILE_SITE_KEY gesetzt ist */
export function Turnstile({ onToken, nonce }: { onToken: (t: string) => void; nonce?: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  useEffect(() => {
    if (!siteKey) return;
    const iv = setInterval(() => {
      if (window.turnstile && ref.current && !rendered.current) {
        rendered.current = true;
        window.turnstile.render(ref.current, { sitekey: siteKey, callback: onToken, theme: "dark" });
        clearInterval(iv);
      }
    }, 200);
    return () => clearInterval(iv);
  }, [siteKey, onToken]);
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" nonce={nonce} />
      <div ref={ref} className="min-h-[65px]" />
    </>
  );
}
