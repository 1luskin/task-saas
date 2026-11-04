/** Inhalte der Landingpage: Standardwerte im Code, überschreibbar per DB (site_content, Superadmin). */
export type FeatureIcon = "kanban" | "clock" | "euro" | "link" | "invoice" | "offline" | "phone" | "shield";

export interface LandingContent {
  nav: { features: string; pricing: string; faq: string; login: string };
  hero: { badge: string; kicker: string; title: string; text: string; cta: string; demo: string; trust: string };
  featuresTitle: string;
  features: { t: string; d: string; icon: FeatureIcon }[];
  stepsTitle: string;
  steps: { t: string; d: string }[];
  pricingTitle: string;
  perEmployee: string;
  planItems: { start: string[]; pro: string[] };
  pricingCta: string;
  reviewsTitle: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
  finalTitle: string;
  finalText: string;
}

const de: LandingContent = {
  nav: { features: "Funktionen", pricing: "Preise", faq: "FAQ", login: "Anmelden" },
  hero: {
    badge: "14 Tage kostenlos",
    kicker: "Für Reinigung, Handwerk, Bau, Lager",
    title: "Aufgaben, Zeiten und Löhne. In einer App.",
    text: "Der Chef verteilt Aufgaben am PC, das Team erledigt sie am Handy. Sie sehen sofort, wer was macht, was es kostet und was übrig bleibt.",
    cta: "Jetzt 14 Tage testen",
    demo: "Demo ansehen",
    trust: "Keine Kreditkarte · Server in Frankfurt · DSGVO-konform",
  },
  featuresTitle: "Alles, was ein kleiner Betrieb braucht",
  features: [
    { t: "Aufgaben & Prüfung", d: "Verteilen, priorisieren, mit Checklisten und Fotos. Erledigte Arbeit nehmen Sie mit einem Klick ab.", icon: "kanban" },
    { t: "Zeiten erfassen", d: "„Begonnen“ und „Fertig“ am Handy – die Zeit pro Aufgabe wird automatisch erfasst.", icon: "clock" },
    { t: "Löhne & Gewinn", d: "Stundenlohn oder Festpreis. Gewinn pro Auftrag – gezählt wird erst nach Abnahme.", icon: "euro" },
    { t: "Excel & PDF", d: "Monatsübersicht als Excel für den Steuerberater, Wochenbericht als PDF.", icon: "invoice" },
    { t: "Funktioniert offline", d: "Im Keller ohne Netz? Kein Problem, alles wird später synchronisiert.", icon: "offline" },
    { t: "Handy-App ohne Store", d: "Mit einem Tipp auf den Startbildschirm. Große Knöpfe – auch mit Handschuhen.", icon: "phone" },
  ],
  stepsTitle: "So funktioniert's",
  steps: [
    { t: "Betrieb anlegen", d: "In 2 Minuten, ohne Passwort, nur mit E-Mail-Code." },
    { t: "Team einladen", d: "Link per WhatsApp schicken, fertig. App aufs Handy legen." },
    { t: "Aufgaben verteilen", d: "Am PC planen, das Team erledigt alles am Handy." },
  ],
  pricingTitle: "Preise",
  perEmployee: "pro Mitarbeiter / Monat",
  planItems: {
    start: ["Aufgaben & Kalender", "Zeiterfassung", "Löhne & Excel-Export", "App für Mitarbeiter"],
    pro: ["Alles aus Start", "Kunden & Kundenlink", "Rechnungen & DATEV", "Berichte"],
  },
  pricingCta: "14 Tage kostenlos testen",
  reviewsTitle: "Das sagen unsere Kunden",
  faqTitle: "Häufige Fragen",
  faq: [
    { q: "Wo liegen meine Daten?", a: "Auf Servern in Frankfurt am Main. Wir schließen mit Ihnen einen AV-Vertrag nach DSGVO." },
    { q: "Muss ich eine App installieren?", a: "Nein. Die App läuft im Browser und lässt sich mit einem Tipp auf den Startbildschirm legen." },
    { q: "Was passiert nach 14 Tagen?", a: "Ihre Daten bleiben erhalten und exportierbar. Sie entscheiden, ob Sie weitermachen." },
    { q: "Gibt es die App auch auf Russisch?", a: "Ja, jeder Mitarbeiter wählt Deutsch oder Russisch." },
  ],
  finalTitle: "Bereit für weniger Zettelwirtschaft?",
  finalText: "Testen Sie 14 Tage kostenlos – mit Demo-Firma zum Ausprobieren.",
};

const ru: LandingContent = {
  nav: { features: "Функции", pricing: "Цены", faq: "Вопросы", login: "Войти" },
  hero: {
    badge: "14 дней бесплатно",
    kicker: "Для клининга, ремонта, стройки, складов",
    title: "Задачи, время и зарплаты. В одном приложении.",
    text: "Начальник раздаёт задачи на ПК, команда выполняет их с телефона. Вы сразу видите, кто что делает, сколько это стоит и что остаётся.",
    cta: "Попробовать 14 дней",
    demo: "Посмотреть демо",
    trust: "Без карты · Серверы во Франкфурте · По DSGVO",
  },
  featuresTitle: "Всё, что нужно маленькой фирме",
  features: [
    { t: "Задачи и приёмка", d: "Раздавайте, ставьте приоритет, чек-листы и фото. Готовую работу принимаете одним нажатием.", icon: "kanban" },
    { t: "Учёт времени", d: "«Начал» и «Закончил» на телефоне — время по задаче считается само.", icon: "clock" },
    { t: "Зарплаты и прибыль", d: "Почасово или фикс. Прибыль по заказу — считается только после приёмки.", icon: "euro" },
    { t: "Excel и PDF", d: "Итоги месяца в Excel для Steuerberater, недельный отчёт в PDF.", icon: "invoice" },
    { t: "Работает без интернета", d: "В подвале нет сети? Не страшно — всё синхронизируется позже.", icon: "offline" },
    { t: "Приложение без магазина", d: "Одно нажатие — и иконка на экране. Крупные кнопки — даже в перчатках.", icon: "phone" },
  ],
  stepsTitle: "Как это работает",
  steps: [
    { t: "Создайте фирму", d: "2 минуты, без пароля — только код из письма." },
    { t: "Пригласите команду", d: "Отправьте ссылку в WhatsApp, и всё. Иконка на телефоне." },
    { t: "Раздавайте задачи", d: "Планируете на ПК, команда делает всё с телефона." },
  ],
  pricingTitle: "Цены",
  perEmployee: "за сотрудника / месяц",
  planItems: {
    start: ["Задачи и календарь", "Учёт времени", "Зарплаты и Excel", "Приложение для сотрудников"],
    pro: ["Всё из Start", "Клиенты и ссылка заказчика", "Счета и DATEV", "Отчёты"],
  },
  pricingCta: "Попробовать 14 дней бесплатно",
  reviewsTitle: "Что говорят клиенты",
  faqTitle: "Частые вопросы",
  faq: [
    { q: "Где хранятся мои данные?", a: "На серверах во Франкфурте-на-Майне. Заключаем с вами AVV по DSGVO." },
    { q: "Нужно ли устанавливать приложение?", a: "Нет. Оно работает в браузере и одним нажатием добавляется на экран телефона." },
    { q: "Что будет через 14 дней?", a: "Данные сохранятся и экспортируются. Вы решаете, продолжать ли." },
    { q: "Есть ли приложение на немецком?", a: "Да, каждый сотрудник выбирает немецкий или русский." },
  ],
  finalTitle: "Меньше бумажек и звонков?",
  finalText: "Попробуйте 14 дней бесплатно — с демо-фирмой для знакомства.",
};

export const LANDING_DEFAULTS = { de, ru };

/** Flaches Zusammenführen: DB-Werte überschreiben nur vorhandene Schlüssel mit gleichem Typ */
export function mergeLanding(base: LandingContent, override: unknown): LandingContent {
  if (!override || typeof override !== "object") return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    const b = (base as unknown as Record<string, unknown>)[k];
    if (b === undefined || v == null) continue;
    if (Array.isArray(b) ? Array.isArray(v) : typeof b === typeof v) {
      out[k] = typeof b === "object" && !Array.isArray(b) ? { ...(b as object), ...(v as object) } : v;
    }
  }
  return out as unknown as LandingContent;
}
