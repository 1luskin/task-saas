/**
 * Content-Security-Policy mit Nonce (pro Request in proxy.ts erzeugt).
 * Erlaubt: eigene Domain, Supabase (https + wss), Kartenkacheln, Sentry, Turnstile.
 */
export function buildCsp(nonce: string, opts: { dev?: boolean; supabaseUrl?: string; tileUrl?: string; sentryDsn?: string } = {}): string {
  const origin = (u?: string) => {
    try {
      return u ? new URL(u.replace("{s}", "a").replace("{z}", "0").replace("{x}", "0").replace("{y}", "0")).origin : "";
    } catch {
      return "";
    }
  };
  const supa = origin(opts.supabaseUrl);
  const supaWs = supa ? supa.replace(/^https/, "wss") : "";
  const tiles = origin(opts.tileUrl || "https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  const sentry = origin(opts.sentryDsn);
  const turnstile = "https://challenges.cloudflare.com";
  const d = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ""}`,
    // Inline-Style-Attribute (React style={…}) brauchen 'unsafe-inline'; Skripte bleiben streng
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: ${[supa, tiles].filter(Boolean).join(" ")}`.trim(),
    `font-src 'self' data:`,
    `connect-src 'self' ${[supa, supaWs, sentry, turnstile].filter(Boolean).join(" ")}`.trim(),
    `frame-src ${turnstile}`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ];
  if (!opts.dev) d.push("upgrade-insecure-requests");
  return d.join("; ");
}
