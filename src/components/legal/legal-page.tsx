import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { LEGAL_VERSION, legalDoc, type LegalKey } from "@/legal/content";
import { LegalFooter } from "./legal-footer";
import { IconChevronLeft } from "../icons";

export async function LegalPage({ doc }: { doc: LegalKey }) {
  const { locale, t } = await getI18n();
  const d = legalDoc(doc, locale);
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="inline-flex min-h-10 items-center gap-1 text-muted hover:text-ink">
        <IconChevronLeft className="size-5" />
        {t("common.back")}
      </Link>
      <article className="card-white mt-3 space-y-6 p-5 sm:p-8">
        <header>
          <h1 className="text-2xl font-semibold sm:text-3xl">{d.title}</h1>
          <p className="mt-1 text-sm text-muted">Version {LEGAL_VERSION}</p>
        </header>
        {d.sections.map((s) => (
          <section key={s.h} className="space-y-2">
            <h2 className="text-lg font-semibold">{s.h}</h2>
            {s.p.map((p, i) => (
              <p key={i} className="whitespace-pre-wrap text-ink-2">{p}</p>
            ))}
          </section>
        ))}
      </article>
      <LegalFooter />
    </main>
  );
}
