# LAUNCH_CHECKLIST — что сделать руками перед рекламой

## Инфраструктура
- [ ] Supabase-проект в регионе **Frankfurt**, все миграции применены (`npx supabase db push`).
- [ ] **Свой SMTP в Supabase Auth** (Brevo/Postmark/Mailjet). Без него встроенная почта отправляет несколько писем в час — регистрации встанут.
- [ ] Шаблоны писем Supabase (*Magic Link*, *Confirm signup*) содержат `{{ .Token }}` (см. README, п. 3).
- [ ] Расширения `pg_cron` и `pg_net` включены, частый cron включён: `select private.enable_frequent_cron('https://ДОМЕН/api/cron/frequent', 'CRON_SECRET');`
- [ ] Vercel: все переменные из `.env.example`, регион `fra1`, свой домен, `NEXT_PUBLIC_APP_URL` = домен.
- [ ] VAPID-ключи (`npm run vapid`), `CRON_SECRET`, `SUPERADMIN_EMAILS` (ваш e-mail).
- [ ] Brevo (или другой провайдер): `BREVO_API_KEY`, домен отправителя подтверждён (SPF/DKIM/DMARC).
- [ ] Sentry (EU-регион) — `SENTRY_DSN`; по желанию Cloudflare Turnstile — ключи в env.
- [ ] Резервные копии Supabase (Point-in-Time Recovery на платном плане) — проверить, что включены.

## Тексты и юридическое
- [ ] Заполнить плейсхолдеры в `src/legal/content.ts`: `[ИМЯ / FIRMA]`, `[АДРЕС]`, `[EMAIL]`, `[ТЕЛЕФОН]`, `[USt-IdNr]`, `[HANDELSREGISTER]`, `[VERTRETUNGSBERECHTIGTE PERSON]`, `[ORT]`, `[E-MAIL-ANBIETER]`, `[TILE-ANBIETER]`.
- [ ] Дать Impressum, Datenschutzerklärung, AGB, AVV на проверку юристу (тексты — заготовка).
- [ ] Заключить AVV (Auftragsverarbeitung) с Supabase, Vercel, почтовым провайдером, Sentry (у всех есть стандартные DPA).
- [ ] Контакт для «Связаться с нами» — `CONTACT_MAILTO` в `src/components/trial/trial.tsx`.
- [ ] Название продукта — `APP_NAME` в `src/config/app.ts` (+ `EMAIL_FROM_NAME`).

## Цены и продажи
- [ ] Цены Start/Pro за сотрудника — в суперадминке `/admin/content` (до этого на сайте `[ЦЕНА]`).
- [ ] Тексты лендинга — проверить/подправить в `/admin/content` (DE и RU).
- [ ] Оплата: сейчас заглушка «Оплата скоро будет доступна». Подключить Stripe позже через `PaymentProvider` (`src/lib/payments`), пока включать тариф вручную в `/admin` («Оплачено»).

## Проверить со Steuerberater
- [ ] Excel-выгрузку за месяц (листы: итоги, задачи, расходы, премии/вычеты).
- [ ] DATEV-экспорт (`Деньги → DATEV-Export`): Beraternummer, Mandantennummer, SKR03/04 и счета по умолчанию (Debitor 10000, Kasse, Betriebsbedarf, Wareneingang, Erlöse 19/7/0 %/§19) — Steuerberater импортирует тестовый месяц и подтверждает; при необходимости поменять счета в настройках.
- [ ] Счета: образец PDF (обязательные данные §14 UStG, формулировка §19, сторно), нумерация `RE-ГГГГ-0001`, срок оплаты.
- [ ] XRechnung: скачать XML тестового счёта и проверить валидатором KoSIT (https://github.com/itplr-kosit/validator, сценарии XRechnung 3.0) или онлайн-сервисом; при ошибках — поправить `src/lib/xrechnung.ts`.
- [ ] Решить, включать ли «Rechnungen» по умолчанию для новых фирм (сейчас глобально выключено, `/admin` → флаги).

## Финальная проверка руками
- [ ] Реквизиты своей фирмы для счетов (Einstellungen → Rechnungsdaten) — если сами пользуетесь счетами.
- [ ] Регистрация с реального e-mail → код приходит за секунды → онбординг → демо-фирма → «Смотреть как работник» → «Заказчик».
- [ ] Приглашение сотрудника через WhatsApp, вход сотрудника на Android и iPhone (PWA «На экран Домой», push).
- [ ] Офлайн: «Начал/Закончил» и смена без сети → синхронизация после появления сети.
- [ ] После 14 дней (сдвинуть дату в `/admin` или подождать): создавать нельзя, экспорт работает.
- [ ] Lighthouse на телефоне (цель ≥ 90) для лендинга и экрана «Сегодня».
