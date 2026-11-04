// Prüft, dass keine Server-Geheimnisse im Client-Bundle landen (läuft nach `next build`, auch in CI).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = ".next/static";
const forbidden = [/SUPABASE_SERVICE_ROLE_KEY/, /VAPID_PRIVATE_KEY/, /CRON_SECRET/, /TURNSTILE_SECRET_KEY/, /"role"\s*:\s*"service_role"/];
const secrets = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.VAPID_PRIVATE_KEY, process.env.CRON_SECRET].filter((s) => s && s.length > 8);
let bad = 0;
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|css|html|json)$/.test(f)) {
      const c = readFileSync(p, "utf8");
      for (const re of forbidden) if (re.test(c)) { console.error(`✗ ${p}: ${re}`); bad++; }
      for (const s of secrets) if (c.includes(s)) { console.error(`✗ ${p}: Geheimniswert im Bundle`); bad++; }
    }
  }
};
walk(root);
if (bad) process.exit(1);
console.log("✓ Client-Bundle ohne Server-Geheimnisse");
