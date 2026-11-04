import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Euro, FileSpreadsheet, KanbanSquare, Link2, ShieldCheck, Smartphone, WifiOff, Star } from "lucide-react";
import { getContext } from "@/lib/auth";
import { getLocale } from "@/i18n/server";
import { isLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { getPlans } from "@/lib/plans";
import { formatMoney } from "@/lib/money";
import { APP_NAME } from "@/config/app";
import { LANDING_DEFAULTS, mergeLanding, type FeatureIcon } from "@/landing/content";
import { LegalFooter } from "@/components/legal/legal-footer";

const ICONS: Record<FeatureIcon, typeof Clock> = {
  kanban: KanbanSquare, clock: Clock, euro: Euro, link: Link2, invoice: FileSpreadsheet, offline: WifiOff, phone: Smartphone, shield: ShieldCheck,
};

type SP = { lang?: string };

async function pickLocale(sp: SP) {
  return isLocale(sp.lang) ? sp.lang : await getLocale();
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const locale = await pickLocale(await searchParams);
  const c = LANDING_DEFAULTS[locale];
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    title: `${APP_NAME} – ${c.hero.title}`,
    description: c.hero.text,
    metadataBase: new URL(base),
    alternates: { canonical: "/", languages: { de: "/?lang=de", ru: "/?lang=ru", "x-default": "/" } },
    openGraph: { title: `${APP_NAME} – ${c.hero.title}`, description: c.hero.text, type: "website", locale: locale === "ru" ? "ru_RU" : "de_DE" },
    robots: { index: true, follow: true },
  };
}

/** "/" – Landingpage für Gäste; Angemeldete gehen direkt in die App. */
export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (ctx) {
    if (!ctx.member) redirect("/onboarding");
    redirect(ctx.member.role === "boss" ? "/boss" : "/staff/today");
  }
  const locale = await pickLocale(sp);
  const supabase = await createClient();
  const [{ data: row }, plans, { data: reviews }] = await Promise.all([
    supabase.from("site_content").select("data").eq("key", "landing").eq("locale", locale).maybeSingle(),
    getPlans(),
    supabase.rpc("published_reviews", { p_limit: 6 }),
  ]);
  const c = mergeLanding(LANDING_DEFAULTS[locale], row?.data);
  const other = locale === "de" ? "ru" : "de";

  return (
    <div className="min-h-dvh">
      <header className="pt-safe sticky top-0 z-30 bg-bg/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3" aria-label="Hauptnavigation">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <img src="/icons/icon.svg" alt="" className="size-8 rounded-[9px]" />
            {APP_NAME}
          </Link>
          <div className="ml-auto hidden gap-5 text-sm text-ink-2 md:flex">
            <a href="#features" className="hover:text-ink">{c.nav.features}</a>
            <a href="#pricing" className="hover:text-ink">{c.nav.pricing}</a>
            <a href="#faq" className="hover:text-ink">{c.nav.faq}</a>
          </div>
          <Link href={`/?lang=${other}`} hrefLang={other} className="ml-auto inline-flex min-h-11 items-center text-sm text-muted hover:text-ink md:ml-0">
            {other.toUpperCase()}
          </Link>
          <Link href="/login" className="btn-secondary !min-h-11">{c.nav.login}</Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 lg:grid-cols-2 lg:pt-20">
          <div className="space-y-5">
            <span className="chip bg-accent-soft text-link">{c.hero.badge}</span>
            <p className="text-muted">{c.hero.kicker}</p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{c.hero.title}</h1>
            <p className="max-w-xl text-lg text-ink-2">{c.hero.text}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary btn-xl w-full sm:w-auto">{c.hero.cta}</Link>
              <Link href="/login?next=%2Fboss" className="btn-secondary btn-xl w-full sm:w-auto">{c.hero.demo}</Link>
            </div>
            <p className="text-sm text-muted">{c.hero.trust}</p>
          </div>
          <HeroMock />
        </section>

        {/* Funktionen */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
          <h2 className="mb-8 text-3xl font-semibold">{c.featuresTitle}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.map((f) => {
              const I = ICONS[f.icon] ?? ShieldCheck;
              return (
                <div key={f.t} className="card-white space-y-2 p-5">
                  <span className="flex size-11 items-center justify-center rounded-[12px] bg-card text-link"><I className="size-6" strokeWidth={1.8} aria-hidden /></span>
                  <h3 className="text-lg font-semibold">{f.t}</h3>
                  <p className="text-ink-2">{f.d}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3 Schritte */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mb-8 text-3xl font-semibold">{c.stepsTitle}</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {c.steps.map((s, i) => (
              <li key={s.t} className="card-white space-y-2 p-5">
                <span className="font-display text-sm font-semibold text-accent-2">{i + 1}</span>
                <h3 className="text-lg font-semibold">{s.t}</h3>
                <p className="text-ink-2">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Preise */}
        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
          <h2 className="mb-8 text-3xl font-semibold">{c.pricingTitle}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {plans.map((p) => (
              <div key={p.id} className={`card-white flex flex-col gap-4 p-6 ${p.id === "pro" ? "ring-2 ring-accent" : ""}`}>
                <h3 className="text-xl font-semibold">{p.id === "pro" ? "Pro" : "Start"}</h3>
                <div>
                  <span className="font-display text-4xl font-semibold tabular-nums">{p.pricePerEmployeeCents == null ? "[ЦЕНА]" : formatMoney(p.pricePerEmployeeCents, locale)}</span>
                  <span className="ml-2 text-muted">{c.perEmployee}</span>
                </div>
                <ul className="space-y-2 text-ink-2">
                  {c.planItems[p.id].map((it) => (
                    <li key={it} className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" strokeWidth={1.8} aria-hidden />{it}</li>
                  ))}
                </ul>
                <Link href="/login" className="btn-primary mt-auto">{c.pricingCta}</Link>
              </div>
            ))}
          </div>
        </section>

        {/* Bewertungen: nur echte, freigegebene – sonst ausgeblendet */}
        {(reviews ?? []).length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="mb-8 text-3xl font-semibold">{c.reviewsTitle}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {reviews!.map((r, i) => (
                <figure key={i} className="card-white space-y-3 p-5">
                  <div className="flex gap-0.5" aria-label={`${r.rating}/5`}>
                    {Array.from({ length: 5 }, (_, n) => <Star key={n} className={`size-4 ${n < r.rating ? "fill-review text-review" : "text-muted"}`} strokeWidth={1.8} aria-hidden />)}
                  </div>
                  <blockquote className="text-ink-2">{r.comment}</blockquote>
                  {r.client_name && <figcaption className="text-sm text-muted">{r.client_name}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16">
          <h2 className="mb-6 text-3xl font-semibold">{c.faqTitle}</h2>
          <div className="space-y-2">
            {c.faq.map((f) => (
              <details key={f.q} className="card-white group p-0">
                <summary className="flex min-h-14 cursor-pointer items-center px-5 font-semibold">{f.q}</summary>
                <p className="px-5 pb-5 text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Abschluss-CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="card-white flex flex-col items-start gap-4 p-8 md:flex-row md:items-center">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold">{c.finalTitle}</h2>
              <p className="mt-1 text-ink-2">{c.finalText}</p>
            </div>
            <Link href="/login" className="btn-primary btn-xl">{c.hero.cta}</Link>
          </div>
        </section>
      </main>
      <LegalFooter className="pb-10" />
    </div>
  );
}

/** Stilisierte Vorschau des Dashboards (kein Bild – leicht und scharf auf jedem Display) */
function HeroMock() {
  const rows = [
    ["DI", "Treppenhaus reinigen", "bg-accent-soft text-link", "In Arbeit"],
    ["LW", "Badfliesen verfugen", "bg-review-soft text-review", "Zur Prüfung"],
    ["OP", "Fenster Kita", "bg-ok-soft text-ok", "Erledigt"],
  ];
  return (
    <div aria-hidden className="card-white space-y-3 p-4 shadow-2xl shadow-black/30">
      <div className="grid grid-cols-3 gap-2">
        {[["Überfällig", "2", "text-danger"], ["Zur Prüfung", "3", "text-review"], ["Gewinn", "1.240 €", "text-link"]].map(([l, v, c]) => (
          <div key={l} className="rounded-[12px] bg-card p-3">
            <div className="text-xs text-muted">{l}</div>
            <div className={`font-display text-xl font-semibold tabular-nums ${c}`}>{v}</div>
          </div>
        ))}
      </div>
      {rows.map(([i, t, cls, s]) => (
        <div key={t} className="flex items-center gap-3 rounded-[12px] bg-card p-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold">{i}</span>
          <span className="flex-1 text-sm">{t}</span>
          <span className={`chip ${cls}`}>{s}</span>
        </div>
      ))}
      <div className="grid grid-cols-7 gap-1 pt-1">
        {Array.from({ length: 28 }, (_, n) => (
          <div key={n} className={`flex h-8 items-start justify-center rounded-[6px] pt-1 text-[10px] ${n === 10 ? "bg-accent-2 text-bg" : "bg-card text-muted"}`}>{n + 1}</div>
        ))}
      </div>
    </div>
  );
}
