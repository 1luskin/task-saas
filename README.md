# Werkplan — задачи, время и заработок для маленьких фирм

SaaS для небольших фирм в Германии (клининг, ремонт, стройка, склады): начальник раздаёт задачи на ПК,
команда работает с телефона (PWA, офлайн). Учёт времени и смен, приёмка работы, заработок и прибыль,
клиенты и ссылка заказчика, команда (график смен, отпуска, доска объявлений, дневные отчёты, документы, база знаний,
формы → PDF, импорт из Excel), аналитика (графики, отчёт сотрудника за месяц), DATEV-экспорт, склад материалов,
предложения и счета (§14 UStG, GoBD, сторно, XRechnung), Excel/PDF, пробный период 14 дней, суперадминка. Языки DE + RU.

> Рабочее имя продукта — константа `APP_NAME` в `src/config/app.ts` (меняется в одном месте).
> Прогресс по ТЗ — `PROGRESS.md`, принятые решения — `DECISIONS.md`, что сделать руками перед запуском — `LAUNCH_CHECKLIST.md`,
> итоговый отчёт (что сделано, что нет и почему) — `REPORT.md`.

**Стек:** Next.js 16 (App Router, TypeScript strict) · Tailwind CSS v4 · Supabase (Postgres, Auth, Storage, регион Frankfurt) · Vercel (fra1) · Vitest · Playwright

---

## 1. Быстрый старт без ключей (демо-режим)

```bash
npm install
npm run dev            # http://localhost:3000
```

Без `NEXT_PUBLIC_SUPABASE_URL` (или с `NEXT_PUBLIC_DEMO_MODE=1`) приложение работает на тестовых данных в памяти:
фирма, начальница, 3 сотрудника, 10 задач во всех статусах, смены, расходы, клиенты, ссылка заказчика.
На `/login` выбирается, кем войти; суперадминка `/admin` доступна демо-начальнице. Права те же, что в БД
(`src/lib/demo/fake-client.ts` повторяет RLS и триггеры).

## 2. Проверки

```bash
npm run typecheck      # TypeScript
npm run lint           # ESLint
npm test               # Vitest (unit)
npm run build && npm run check:bundle   # сборка + проверка, что секретов нет в клиентском бандле
npm run test:e2e       # Playwright в демо-режиме (сам собирает и запускает сервер на :3123)
PGHOST=/tmp PGPORT=5432 tests/sql/run.sh   # миграции + RLS-тесты на локальном Postgres 16 (свежая БД на каждый файл)
```

`tests/sql/run.sh` создаёт базу, ставит заглушку схем `auth`/`storage` (`tests/sql/supabase-stub.sql`),
применяет все миграции и прогоняет SQL-тесты прав (`tests/sql/[0-9]*.sql`; строки «muss scheitern» должны дать ошибку).
`13-cross-firm.sql` автоматически обходит **все** таблицы схемы `public`: вторая фирма и anon не должны увидеть ни строки
первой (новая таблица без RLS сразу проявится). E2E включает проверку доступности (axe, WCAG 2.1 AA) и зон нажатия.

---

## 3. Подключение Supabase

1. **Проект** — создать в регионе **Central EU (Frankfurt)**.
2. **Миграции** — по порядку из `supabase/migrations`:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   (или вставить файлы по очереди в SQL Editor).
3. **Auth → Providers → Email**: включено. **Auth → Email Templates**: в шаблонах *Magic Link* и *Confirm signup*
   должен быть код, иначе придёт только ссылка:
   ```html
   <h2>Ihr Anmeldecode / Ваш код</h2>
   <p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   ```
4. **Свой SMTP обязателен** (Auth → SMTP Settings). Встроенная почта Supabase шлёт всего несколько писем в час —
   регистрации встанут. Подойдёт Brevo, Postmark, Mailjet (сервер в ЕС предпочтителен).
5. **Auth → URL Configuration**: Site URL = ваш домен; **Sessions**: при желании «Inactivity timeout» (например, 7 дней).
6. **Storage** — бакеты создаются миграциями: `task-photos`, `receipts` (приватные), `firm-logos` (публичный, только картинки ≤ 512 КБ).
7. **Database → Extensions**: включить `pg_cron` и `pg_net` (для частых задач, см. п. 5).

## 4. Переменные окружения

Все переменные перечислены в `.env.example` (локально — `.env.local`, на Vercel — Settings → Environment Variables).

| Переменная | Назначение |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **только сервер** (cron, push, ссылка заказчика, суперадминка). Никогда с `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | публичный URL (ссылки-приглашения, ссылки заказчика, письма, sitemap) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push; ключи: `npm run vapid` |
| `CRON_SECRET` | защита `/api/cron/daily` и `/api/cron/frequent` (Bearer) |
| `SUPERADMIN_EMAILS` | e-mail владельца сервиса через запятую → доступ к `/admin` |
| `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | письма приложения (без ключа пишутся в лог) |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | ошибки в Sentry (EU-регион), без ключа выключено |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile на входе и публичной форме, без ключей выключено |
| `NEXT_PUBLIC_MAP_TILE_URL` | сервер тайлов карты (по умолчанию OpenStreetMap) |
| `NEXT_PUBLIC_DEMO_MODE` | `1` = принудительно демо-режим |

## 5. Фоновые задачи

- **Ежедневно** — Vercel Cron (`vercel.json`, 04:00 UTC) → `/api/cron/daily`: задачи из шаблонов (со ссылкой на инструкцию;
  в одобренный отпуск — без исполнителя), уведомления о просрочке, окончательное удаление фирм через 30 дней после запроса,
  геометки по сроку хранения фирмы, журнал входов (90 дней), напоминание о документах сотрудников (≤ 30 дней до конца срока),
  удаление счетов после 10 лет хранения (GoBD), письма (конец пробного периода, недельная сводка).
- **Каждые 15 минут** — `/api/cron/frequent`: авто-приёмка работы через N дней и напоминание начальнику, авто-закрытие
  забытых смен. Vercel Hobby так часто не умеет, поэтому вызывает Supabase:
  ```sql
  -- SQL Editor в Supabase (после включения pg_cron и pg_net)
  select private.enable_frequent_cron('https://ВАШ-ДОМЕН/api/cron/frequent', 'ЗНАЧЕНИЕ_CRON_SECRET');
  -- выключить:
  select private.disable_frequent_cron();
  ```

## 6. Деплой на Vercel

1. Импортировать репозиторий, Framework: Next.js. Регион функций уже задан (`fra1` в `vercel.json`).
2. Добавить все переменные из п. 4 (Production + Preview).
3. Задать `CRON_SECRET` — Vercel сам передаёт его в ежедневный cron.
4. Подключить свой домен, указать его в `NEXT_PUBLIC_APP_URL` и в Supabase → Auth → URL Configuration.
5. Включить частый cron (п. 5).
6. Проверить: регистрация по коду, создание фирмы → онбординг → демо-фирма, приглашение сотрудника, push (на iPhone
   только после «На экран Домой»), Excel/PDF.

---

## 7. Архитектура

```
supabase/migrations/        схема, RLS на каждой таблице и бакете, триггеры-охранники, RPC (нумерация по датам)
src/proxy.ts                CSP с nonce, обновление сессии, редирект на /login
src/app/                    страницы: / (лендинг), /login, /boss/*, /staff/*, /admin/*, /c/[token] (заказчик),
                            /o/[token] (предложение), /f/[slug] (публичная форма), правовые
src/app/api/                sync (офлайн-очередь), cron/daily, cron/frequent, export (xlsx/zip/json, DATEV EXTF),
                            reports (недельный и месячный PDF), invoices (PDF, XRechnung XML), offers, forms (PDF), avatar
src/lib/datev.ts            Buchungsstapel EXTF v700 (CP1252), счета SKR03/04
src/lib/invoice-calc.ts     суммы счёта (= SQL), src/lib/xrechnung.ts — XRechnung 3.0 CII; src/lib/pdf.ts — PDF-хелпер
src/server/actions/         server actions: zod-валидация + роль + фирма + фича-флаг + пробный период
src/lib/                    auth, finance/earnings, workflow (статусы), trial, features, rate-limit, shifts, email, demo
src/i18n/                   словари DE/RU (новый язык — файл + запись в config.ts)
src/legal/                  тексты Impressum/Datenschutz/AGB/AVV (плейсхолдеры)
tests/unit|e2e|sql          Vitest, Playwright (демо, вкл. axe), SQL-тесты RLS/GoBD/изоляции
design/                     макеты экранов (HTML-эскизы) и DESIGN.md
```

**Безопасность (кратко):** RLS везде, изоляция фирм через `private.my_firm_id()`; сотрудник видит только своё,
финансы фирмы — только начальник; переходы статусов и неизменяемые поля охраняют триггеры; вход по коду через сервер
с лимитами в Postgres; CSP с nonce, HSTS; повторный код для опасных действий; Sentry без персональных данных.
Подробности и причины — `DECISIONS.md`.

**Capacitor (App Store / Google Play):** относительные URL, без браузерных хаков; push заменяется в
`src/lib/offline/push-client.ts` и `src/lib/push.ts`.
