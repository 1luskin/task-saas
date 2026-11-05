/**
 * Rechtstexte (DE verbindlich, RU zur Information). Platzhalter in [ECKIGEN KLAMMERN]
 * vor dem Start ersetzen (siehe LAUNCH_CHECKLIST.md). Kein HTML – nur Text.
 * Bei Änderungen LEGAL_VERSION erhöhen (Einwilligungen speichern die Version).
 */
import { APP_NAME } from "@/config/app";

export const LEGAL_VERSION = "2026-11-04";

export type LegalKey = "impressum" | "datenschutz" | "agb" | "avv";
export interface LegalDoc {
  title: string;
  sections: { h: string; p: string[] }[];
}

const P = {
  name: "[ИМЯ / FIRMA]",
  address: "[АДРЕС]",
  email: "[EMAIL]",
  phone: "[ТЕЛЕФОН]",
  vat: "[USt-IdNr]",
  register: "[HANDELSREGISTER]",
  rep: "[VERTRETUNGSBERECHTIGTE PERSON]",
};

const SUBPROCESSORS_DE = [
  "Supabase Inc. – Datenbank, Anmeldung, Dateispeicher; Serverstandort Frankfurt am Main (EU). Standardvertragsklauseln.",
  "Vercel Inc. – Hosting der Web-App; Funktionen in Frankfurt (fra1). EU-US Data Privacy Framework / Standardvertragsklauseln.",
  "[E-MAIL-ANBIETER, z. B. Brevo (Sendinblue SAS), Paris/EU] – Versand von Anmeldecodes und Benachrichtigungen.",
  "Functional Software Inc. (Sentry) – Fehlerprotokolle, Datenspeicherung in der EU (Frankfurt); ohne personenbezogene Inhalte.",
  "OpenStreetMap Foundation bzw. [TILE-ANBIETER] – Kartenkacheln (IP-Adresse wird beim Laden übertragen).",
  "Cloudflare Inc. (Turnstile) – Schutz vor automatisierten Anmeldungen, nur wenn aktiviert.",
];
const SUBPROCESSORS_RU = [
  "Supabase Inc. — база данных, вход, хранение файлов; серверы во Франкфурте (ЕС). Стандартные договорные положения.",
  "Vercel Inc. — хостинг веб-приложения; функции во Франкфурте (fra1). EU-US Data Privacy Framework / стандартные положения.",
  "[ПОЧТОВЫЙ ПРОВАЙДЕР, напр. Brevo, Париж/ЕС] — отправка кодов входа и уведомлений.",
  "Functional Software Inc. (Sentry) — журнал ошибок, хранение в ЕС (Франкфурт); без персональных данных.",
  "OpenStreetMap Foundation или [ПРОВАЙДЕР ТАЙЛОВ] — тайлы карты (при загрузке передаётся IP-адрес).",
  "Cloudflare Inc. (Turnstile) — защита входа от ботов, только если включено.",
];

const de: Record<LegalKey, LegalDoc> = {
  impressum: {
    title: "Impressum",
    sections: [
      { h: "Angaben gemäß § 5 DDG", p: [P.name, P.address, `Vertreten durch: ${P.rep}`] },
      { h: "Kontakt", p: [`Telefon: ${P.phone}`, `E-Mail: ${P.email}`] },
      { h: "Register und Umsatzsteuer", p: [`Registereintrag: ${P.register}`, `Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${P.vat}`] },
      { h: "Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)", p: [`${P.rep}, ${P.address}`] },
      { h: "Streitschlichtung", p: ["Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."] },
    ],
  },
  datenschutz: {
    title: "Datenschutzerklärung",
    sections: [
      { h: "1. Verantwortlicher", p: [`${P.name}, ${P.address}, E-Mail: ${P.email}, Telefon: ${P.phone}`] },
      {
        h: "2. Welche Daten wir verarbeiten",
        p: [
          "Konto: E-Mail-Adresse, Name, Sprache. Anmeldung erfolgt per Einmal-Code (kein Passwort).",
          "Arbeitsdaten: Aufgaben, Kommentare, Checklisten, Fotos, Zeiterfassung (Beginn/Ende), Verdienstdaten, Urlaubs-/Krankstatus (ohne Diagnose).",
          "Standort: nur wenn die Firma es aktiviert und Sie eingewilligt haben – ausschließlich im Moment „Begonnen/Fertig“ bzw. Schichtbeginn/-ende, keine laufende Ortung.",
          "Technisch: gehashte IP-Adresse für Missbrauchsschutz (Rate-Limit), Browser-Kennung im Login-Protokoll, Fehlerprotokolle ohne Personenbezug.",
        ],
      },
      {
        h: "3. Zwecke und Rechtsgrundlagen",
        p: [
          "Bereitstellung der App für den Arbeitgeber und seine Beschäftigten (Art. 6 Abs. 1 lit. b DSGVO, § 26 BDSG).",
          "Arbeitszeiterfassung nach gesetzlicher Pflicht des Arbeitgebers (Art. 6 Abs. 1 lit. c DSGVO).",
          "Sicherheit und Missbrauchsschutz (Art. 6 Abs. 1 lit. f DSGVO).",
          "Standort, Veröffentlichung von Bewertungen: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), jederzeit widerrufbar.",
          `Für die Daten der Beschäftigten ist die jeweilige Firma Verantwortlicher; ${APP_NAME} verarbeitet diese im Auftrag (Art. 28 DSGVO, siehe AVV).`,
        ],
      },
      { h: "4. Empfänger / Auftragsverarbeiter", p: SUBPROCESSORS_DE },
      {
        h: "5. Speicherdauer",
        p: [
          "Kontodaten bis zur Löschung des Kontos bzw. der Firma (Löschung nach 30 Tagen Widerrufsfrist).",
          "Standortpunkte: 90 Tage (von der Firma einstellbar).",
          "Rechnungen und Belege: 10 Jahre (§ 147 AO, GoBD), auch nach Löschung der Firma.",
          "Login-Protokoll und Rate-Limit-Daten: höchstens 90 Tage.",
        ],
      },
      { h: "6. Cookies", p: ["Wir verwenden nur technisch notwendige Cookies (Anmeldung, Sprache, Bestätigung dieses Hinweises). Keine Analyse- oder Werbe-Cookies."] },
      {
        h: "7. Ihre Rechte",
        p: [
          "Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit (Download Ihrer Daten in der App), Widerspruch, Widerruf von Einwilligungen.",
          "Beschwerde bei einer Datenschutz-Aufsichtsbehörde, z. B. der für den Sitz des Verantwortlichen zuständigen Landesbehörde.",
        ],
      },
    ],
  },
  agb: {
    title: "Allgemeine Geschäftsbedingungen (AGB)",
    sections: [
      { h: "1. Geltungsbereich", p: [`Diese AGB gelten für die Nutzung von ${APP_NAME} durch Unternehmer (§ 14 BGB). Anbieter: ${P.name}, ${P.address}.`] },
      { h: "2. Leistung", p: ["Software als Dienst (SaaS) zur Planung von Aufgaben, Zeiterfassung und Verdienstberechnung. Verfügbarkeit im Jahresmittel angestrebt 99 %."] },
      { h: "3. Testzeitraum", p: ["14 Tage kostenlos und unverbindlich. Danach bleiben Daten lesbar und exportierbar; neue Einträge sind erst mit einem Tarif möglich."] },
      { h: "4. Preise und Zahlung", p: ["Preis pro aktivem Mitarbeiter und Monat gemäß Tarifseite ([ЦЕНА]). Abrechnung monatlich im Voraus. Alle Preise zzgl. gesetzlicher USt."] },
      { h: "5. Laufzeit und Kündigung", p: ["Monatlich kündbar zum Ende des Abrechnungszeitraums. Nach Kündigung: 30 Tage Export, danach Löschung (Belege 10 Jahre)."] },
      { h: "6. Pflichten des Kunden", p: ["Zugangsdaten geheim halten, nur rechtmäßige Inhalte einstellen, Beschäftigte über die Datenverarbeitung informieren."] },
      { h: "7. Haftung", p: ["Unbeschränkt bei Vorsatz und grober Fahrlässigkeit; bei leichter Fahrlässigkeit nur für wesentliche Vertragspflichten, begrenzt auf den vertragstypisch vorhersehbaren Schaden."] },
      { h: "8. Schlussbestimmungen", p: ["Es gilt deutsches Recht. Gerichtsstand: [ORT]."] },
    ],
  },
  avv: {
    title: "Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO",
    sections: [
      { h: "1. Gegenstand", p: [`Der Auftragnehmer (${P.name}) verarbeitet personenbezogene Daten der Beschäftigten und Kunden des Auftraggebers (Firma) ausschließlich zur Bereitstellung von ${APP_NAME}.`] },
      { h: "2. Art der Daten und Betroffene", p: ["Beschäftigte: Name, E-Mail, Telefon, Arbeitszeiten, Aufgaben, Fotos, Verdienst, optional Standortpunkte. Kunden des Auftraggebers: Name, Kontakt, Adresse, Bewertungen."] },
      { h: "3. Weisungen", p: ["Verarbeitung nur auf dokumentierte Weisung des Auftraggebers; die Bedienung der App gilt als Weisung."] },
      { h: "4. Technische und organisatorische Maßnahmen", p: ["Verschlüsselung (TLS), Zugriffsschutz pro Firma (Row Level Security), private Dateispeicher mit kurzlebigen Links, Rate-Limits, Protokollierung, Hosting in der EU (Frankfurt), regelmäßige Datensicherung."] },
      { h: "5. Unterauftragsverarbeiter", p: SUBPROCESSORS_DE },
      { h: "6. Rechte der Betroffenen, Löschung", p: ["Unterstützung bei Anfragen Betroffener. Nach Vertragsende Löschung bzw. Rückgabe (Export) aller Daten, außer gesetzliche Aufbewahrungspflichten."] },
      { h: "7. Kontrollen und Meldepflichten", p: [`Datenschutzverletzungen werden unverzüglich gemeldet an den Auftraggeber. Kontakt: ${P.email}.`] },
    ],
  },
};

const ru: Record<LegalKey, LegalDoc> = {
  impressum: {
    title: "Impressum (выходные данные)",
    sections: [
      { h: "Сведения по § 5 DDG", p: [P.name, P.address, `Представитель: ${P.rep}`] },
      { h: "Контакты", p: [`Телефон: ${P.phone}`, `E-mail: ${P.email}`] },
      { h: "Регистр и НДС", p: [`Запись в реестре: ${P.register}`, `USt-IdNr: ${P.vat}`] },
      { h: "Ответственный за содержание", p: [`${P.rep}, ${P.address}`] },
      { h: "Урегулирование споров", p: ["Мы не участвуем в процедурах урегулирования споров с потребителями."] },
      { h: "Важно", p: ["Юридически обязательна немецкая версия."] },
    ],
  },
  datenschutz: {
    title: "Политика конфиденциальности (Datenschutzerklärung)",
    sections: [
      { h: "1. Ответственный", p: [`${P.name}, ${P.address}, e-mail: ${P.email}, телефон: ${P.phone}`] },
      { h: "2. Какие данные мы обрабатываем", p: ["Аккаунт: e-mail, имя, язык. Вход по одноразовому коду.", "Рабочие данные: задачи, комментарии, чек-листы, фото, учёт времени, заработок, статус отпуска/больничного (без диагнозов).", "Геометка: только если фирма включила и вы согласились — только в момент «Начал/Закончил» и начала/конца смены, без постоянной слежки.", "Технические: хэш IP для защиты от злоупотреблений, браузер в журнале входов, журнал ошибок без персональных данных."] },
      { h: "3. Цели и основания", p: ["Работа приложения для работодателя и сотрудников (ст. 6(1)(b) DSGVO, § 26 BDSG).", "Учёт рабочего времени по обязанности работодателя (ст. 6(1)(c)).", "Безопасность (ст. 6(1)(f)).", "Геометка и публикация отзывов — по согласию (ст. 6(1)(a)), его можно отозвать.", `За данные сотрудников отвечает фирма; ${APP_NAME} обрабатывает их по поручению (ст. 28, см. AVV).`] },
      { h: "4. Получатели / субподрядчики", p: SUBPROCESSORS_RU },
      { h: "5. Сроки хранения", p: ["Данные аккаунта — до удаления аккаунта или фирмы (через 30 дней после запроса).", "Геометки — 90 дней (настраивается фирмой).", "Счета и чеки — 10 лет (§ 147 AO, GoBD), даже после удаления фирмы.", "Журнал входов и лимитов — не более 90 дней."] },
      { h: "6. Cookies", p: ["Только технически необходимые cookies (вход, язык, подтверждение этого уведомления). Никакой аналитики и рекламы."] },
      { h: "7. Ваши права", p: ["Доступ, исправление, удаление, ограничение, переносимость (скачать данные в приложении), возражение, отзыв согласий.", "Жалоба в надзорный орган по защите данных."] },
      { h: "Важно", p: ["Юридически обязательна немецкая версия."] },
    ],
  },
  agb: {
    title: "Условия использования (AGB)",
    sections: [
      { h: "1. Сфера действия", p: [`Условия для использования ${APP_NAME} предпринимателями (§ 14 BGB). Поставщик: ${P.name}, ${P.address}.`] },
      { h: "2. Услуга", p: ["SaaS для планирования задач, учёта времени и расчёта заработка. Целевая доступность 99 % в год."] },
      { h: "3. Пробный период", p: ["14 дней бесплатно. Потом данные видны и экспортируются; создавать новое можно после выбора тарифа."] },
      { h: "4. Цены и оплата", p: ["Цена за активного сотрудника в месяц по странице тарифов ([ЦЕНА]). Оплата помесячно вперёд, плюс НДС."] },
      { h: "5. Срок и расторжение", p: ["Отмена помесячно. После отмены 30 дней на выгрузку, затем удаление (счета хранятся 10 лет)."] },
      { h: "6. Обязанности клиента", p: ["Хранить доступ в тайне, размещать только законные данные, информировать сотрудников об обработке данных."] },
      { h: "7. Ответственность", p: ["Без ограничений при умысле и грубой неосторожности; при лёгкой — только за существенные обязанности и в пределах предвидимого ущерба."] },
      { h: "8. Заключительные положения", p: ["Применяется право Германии. Место разрешения споров: [ГОРОД]. Обязательна немецкая версия."] },
    ],
  },
  avv: {
    title: "Договор обработки данных (AVV, ст. 28 DSGVO)",
    sections: [
      { h: "1. Предмет", p: [`Исполнитель (${P.name}) обрабатывает персональные данные сотрудников и клиентов заказчика (фирмы) только для работы ${APP_NAME}.`] },
      { h: "2. Данные и субъекты", p: ["Сотрудники: имя, e-mail, телефон, время работы, задачи, фото, заработок, при согласии — геометки. Клиенты фирмы: имя, контакт, адрес, отзывы."] },
      { h: "3. Указания", p: ["Обработка только по указанию заказчика; работа в приложении считается указанием."] },
      { h: "4. Технические и организационные меры", p: ["TLS, изоляция данных фирм (Row Level Security), приватные хранилища с короткими ссылками, лимиты, журналирование, хостинг в ЕС (Франкфурт), резервные копии."] },
      { h: "5. Субподрядчики", p: SUBPROCESSORS_RU },
      { h: "6. Права субъектов, удаление", p: ["Помощь в запросах субъектов. После окончания договора — удаление или выгрузка данных, кроме обязательного хранения."] },
      { h: "7. Контроль и уведомления", p: [`Об утечках сообщаем заказчику незамедлительно. Контакт: ${P.email}.`, "Обязательна немецкая версия."] },
    ],
  },
};

export function legalDoc(key: LegalKey, locale: string): LegalDoc {
  return (locale === "ru" ? ru : de)[key];
}
