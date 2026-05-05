# Деплой проекта

## Назначение

Этот документ описывает, как развернуть текущую версию проекта в production.

Проект состоит из трех основных частей:

1. `Next.js` приложение
2. `Supabase` проект для `Postgres` и `Auth`
3. `Telegram Bot` с webhook-доставкой в приложение

Документ написан для текущего состояния репозитория и дополняет [Deploy.md](./Deploy.md) русскоязычным практическим гайдом.

Актуальность рекомендаций по хостингам и платформенным возможностям проверена на `21 апреля 2026`.

## Что именно деплоится

В production работает такая схема:

- пользователь открывает веб-приложение;
- приложение использует `Supabase` для аутентификации и работы с данными;
- `Telegram` отправляет входящие сообщения на HTTPS webhook в `Next.js` приложение;
- приложение сохраняет сообщения в базе и показывает их в inbox;
- сотрудники отеля отвечают через dashboard.

## Базовый production flow

Полный флоу деплоя для этого проекта выглядит так:

1. Подготовить домен и HTTPS.
2. Создать production-проект в `Supabase`.
3. Заполнить production environment variables.
4. Применить миграции из `supabase/migrations`.
5. Создать первого пользователя и первый отель.
6. Задеплоить само `Next.js` приложение на выбранный хостинг.
7. Привязать боевой домен к приложению.
8. Войти в dashboard и сохранить Telegram-интеграцию.
9. Зарегистрировать webhook через `Telegram Bot API`.
10. Выполнить smoke-тесты.

Это означает, что деплой всегда состоит из двух независимых частей:

- `Supabase` как managed backend;
- `Next.js` приложение как runtime для UI, server actions и webhook endpoint.

## Рекомендуемая topology

Для текущего этапа проекта самый понятный production-вариант такой:

- один публичный HTTPS-домен, например `https://hotel-ai.example.com`;
- один `Supabase Cloud` проект;
- один runtime для `Next.js` приложения;
- один или несколько Telegram-ботов, настраиваемых через UI.

## Обязательные переменные окружения

Приложение требует следующие env-переменные:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_BASE_URL=https://hotel-ai.example.com
TELEGRAM_TOKEN_ENCRYPTION_SECRET=replace-with-a-long-random-secret
SUPER_ADMIN_EMAILS=owner@example.com
```

Пояснения:

- `APP_BASE_URL` должен быть реальным публичным production URL;
- `TELEGRAM_TOKEN_ENCRYPTION_SECRET` должен быть длинным, случайным и стабильным после первого релиза;
- `SUPER_ADMIN_EMAILS` необязателен, но полезен для внутреннего доступа;
- нельзя использовать demo или local secrets из `.env.example` в production.

## Production-подготовка

Перед первым деплоем подготовьте:

- домен;
- хостинг или платформу для `Next.js`;
- production-проект в `Supabase`;
- токен Telegram-бота от `@BotFather`;
- email первого администратора отеля;
- `Node.js 22`.

## Шаг 1. Создание проекта в Supabase

Нужно создать новый `Supabase Cloud` проект и сохранить:

- `Project URL`
- `anon key`
- `service role key`

Именно эти значения пойдут в production env приложения.

## Шаг 2. Применение миграций

В репозитории схема хранится в `supabase/migrations`.

Рекомендуемый flow:

1. Установить зависимости.
2. Связать локальный репозиторий с нужным `Supabase` проектом.
3. Выполнить `db push`.

Пример:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Важно:

- миграции нужно применять до запуска новой версии приложения;
- нельзя пропускать старые миграции;
- если позже появится CI/CD, `db push` лучше сделать обязательной частью релиза.

## Шаг 3. Создание первого отеля и первого пользователя

Для доступа в систему одного `Supabase Auth` пользователя недостаточно.

Пользователь должен существовать:

1. в `Supabase Auth`;
2. в `public.hotel_users`.

Порядок:

1. создать пользователя в `Authentication -> Users`;
2. скопировать `auth user UUID`;
3. создать запись в `public.hotels`;
4. создать запись в `public.hotel_users`.

Без этого логин пройдет, но приложение может увести пользователя на `access denied`.

## Шаг 4. Деплой приложения

Текущий проект запускается обычным Node server flow:

```bash
npm ci
npm run build
npm run start
```

Это важно для выбора хостинга: приложению нужен не только статический хостинг, а полноценный runtime для `Next.js`.

## Шаг 5. Настройка домена

После выката приложения:

- привяжите production-домен;
- включите `HTTPS`;
- проверьте, что `APP_BASE_URL` совпадает с финальным доменом.

Если `APP_BASE_URL` будет неправильным, приложение сгенерирует неправильный Telegram webhook URL.

## Шаг 6. Настройка Telegram в UI

После запуска production-версии:

1. откройте `/sign-in`;
2. войдите как `hotel_admin`;
3. откройте `/dashboard/settings/telegram`;
4. заполните:
   - имя интеграции;
   - bot token;
   - optional webhook secret;
5. сохраните настройки.

После этого приложение:

- проверит токен через Telegram;
- сохранит зашифрованный bot token;
- сгенерирует `webhookPathToken`;
- покажет финальный webhook URL.

## Шаг 7. Регистрация webhook в Telegram

После сохранения интеграции нужно вызвать `setWebhook` на URL, который показало приложение.

Пример:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hotel-ai.example.com/api/webhooks/telegram/<webhookPathToken>",
    "drop_pending_updates": true
  }'
```

Если используется секрет:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hotel-ai.example.com/api/webhooks/telegram/<webhookPathToken>",
    "secret_token": "YOUR_WEBHOOK_SECRET",
    "drop_pending_updates": true
  }'
```

Проверка:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

## Шаг 8. Smoke test после релиза

Минимальный список проверок:

1. логин работает;
2. открывается `/dashboard`;
3. Telegram integration активна;
4. входящее сообщение из Telegram доходит до inbox;
5. staff может открыть conversation;
6. staff видит только данные своего отеля.

## Критичные риски

На что стоит обратить внимание в production:

- если не применить миграции, новая версия может не подняться или работать некорректно;
- если сменить `TELEGRAM_TOKEN_ENCRYPTION_SECRET` без миграции, старые токены могут стать нечитаемыми;
- если пользователь есть в `Auth`, но его нет в `hotel_users`, доступ будет заблокирован;
- если `APP_BASE_URL` не совпадает с боевым URL, webhook будет сломан;
- Telegram webhook должен смотреть на публичный `HTTPS` URL.

## Какой хостинг выбрать

Для этого проекта подходят четыре практических сценария.

### 1. Railway

Лучший вариант, если нужен простой production без администрирования сервера.

Подходит, потому что:

- хорошо поддерживает `Next.js`;
- удобно хранит env-переменные;
- легко подключает домен и SSL;
- позволяет деплоить из GitHub;
- удобно для маленькой команды и быстрого старта.

Когда выбирать:

- хотите быстро запустить production;
- не хотите руками поддерживать `Nginx`, `systemd` и сервер;
- хотите простой путь к CI/CD.

### 2. Render

Хороший вариант, если нужен управляемый `Node.js` сервис с понятным runtime-поведением.

Подходит, потому что:

- работает как обычный web service;
- позволяет задать `build command` и `start command`;
- поддерживает custom domains;
- делает zero-downtime deploys;
- удобно живет с постоянным `Next.js` процессом.

Когда выбирать:

- нужен managed hosting, но ближе к классической серверной модели;
- хотите health checks и стабильный long-running process.

### 3. Vercel

Самый удобный хостинг именно для `Next.js`, но у этого проекта есть нюанс: миграции `Supabase` лучше выносить отдельно.

Подходит, потому что:

- почти zero-config для `Next.js`;
- удобно подключать домены;
- быстро выкатываются изменения;
- хорошо подходит для preview environments.

Нюанс:

- `Supabase db push` лучше запускать вручную или через CI до production deploy.

Когда выбирать:

- хотите максимально нативный хостинг для `Next.js`;
- готовы разделить app deploy и database release.

### 4. VPS

Самый предсказуемый и контролируемый вариант. Он ближе всего к текущему [Deploy.md](./Deploy.md).

Подходит, потому что:

- вы полностью контролируете процесс;
- легко повторить documented flow через `Ubuntu + Node + Nginx + systemd`;
- удобно для кастомных сетевых настроек и строгого контроля окружения.

Когда выбирать:

- нужен полный контроль;
- есть готовность администрировать сервер;
- хочется production flow без платформенных ограничений.

## Рекомендация для этого проекта

Если выбирать один вариант под текущий этап:

- `Railway` как самый удобный managed production;
- `VPS` как самый предсказуемый и контролируемый вариант;
- `Vercel` как лучший вариант для самого `Next.js`, если миграции и release flow уже дисциплинированы;
- `Render` как промежуточный баланс между `Railway` и `VPS`.

Если нужен короткий практический выбор:

- быстро и без лишней инфраструктуры: `Railway`
- под строгий контроль и classic ops: `VPS`
- максимальный комфорт для `Next.js`: `Vercel`

## Пошаговый гайд: Railway

### Когда использовать

Если хотите самый быстрый production launch.

### Шаги

1. Подключите GitHub-репозиторий к `Railway`.
2. Создайте service из репозитория.
3. Добавьте env-переменные из раздела выше.
4. Убедитесь, что используются команды:
   - build: `npm run build`
   - start: `npm run start`
5. Получите temporary domain Railway или подключите custom domain.
6. Примените миграции `Supabase` отдельно.
7. Обновите `APP_BASE_URL` на финальный домен.
8. Выполните redeploy.
9. Настройте Telegram через UI и зарегистрируйте webhook.

### Плюсы

- простой onboarding;
- быстрый старт;
- удобно для небольшого production;
- env и deploy flow собраны в одном месте.

### На что обратить внимание

- миграции БД не стоит оставлять "на потом";
- после смены домена обязательно обновить `APP_BASE_URL`.

## Пошаговый гайд: Render

### Когда использовать

Если нужен managed runtime в формате классического web service.

### Шаги

1. Создайте `Web Service` из GitHub-репозитория.
2. Укажите:
   - `Build Command`: `npm run build`
   - `Start Command`: `npm run start`
3. Добавьте env-переменные.
4. При необходимости явно задайте `NODE_VERSION=22`.
5. Подключите custom domain.
6. После первого deploy обновите `APP_BASE_URL`.
7. Примените миграции в `Supabase`.
8. Настройте Telegram через UI.
9. Зарегистрируйте webhook.

### Рекомендуемая дополнительная настройка

- указать health check path, чтобы платформа аккуратнее проводила deploy.

### Плюсы

- predictable runtime;
- удобные логи;
- управляемый сервис без ручного сервера;
- zero-downtime deploys.

## Пошаговый гайд: Vercel

### Когда использовать

Если хотите самый бесшовный деплой именно для `Next.js`.

### Шаги

1. Импортируйте репозиторий в `Vercel`.
2. Добавьте production env-переменные в настройках проекта.
3. Подключите custom domain.
4. Дождитесь production deploy.
5. До релиза или как часть CI примените:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

6. Проверьте, что `APP_BASE_URL` совпадает с production domain.
7. Войдите в приложение, настройте Telegram integration.
8. Зарегистрируйте webhook в Telegram.

### Плюсы

- лучший DX для `Next.js`;
- простой preview flow;
- быстрые выкладки.

### На что обратить внимание

- деплой приложения и релиз схемы БД здесь лучше разделять;
- после изменения env нужен новый deploy.

## Пошаговый гайд: VPS

### Когда использовать

Если нужен полный контроль и классический серверный production.

### Рекомендуемый стек

- `Ubuntu 22.04` или `24.04`
- `Node.js 22`
- `Nginx`
- `systemd`

### Шаги

1. Создайте сервер.
2. Подключитесь по `SSH`.
3. Установите зависимости:

```bash
sudo apt update
sudo apt install -y nginx curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

4. Склонируйте репозиторий:

```bash
git clone <your-repo-url> /opt/hotelAI
cd /opt/hotelAI
npm ci
```

5. Создайте `/opt/hotelAI/.env.production`.
6. Выполните:

```bash
cd /opt/hotelAI
export $(grep -v '^#' .env.production | xargs)
npm run build
```

7. Запустите приложение через `systemd`.
8. Настройте `Nginx` как reverse proxy на порт `3000`.
9. Выпустите `Let's Encrypt` сертификат.
10. Примените миграции в `Supabase`.
11. Настройте Telegram через UI.
12. Зарегистрируйте webhook.

### Плюсы

- полный контроль;
- легко адаптировать под свои требования;
- deployment flow почти полностью совпадает с англоязычным `Deploy.md`.

## Что бы я выбрал на практике

Для текущего проекта:

- если нужен быстрый production сейчас: `Railway`
- если нужен controlled production с предсказуемой инфраструктурой: `VPS`
- если команда живет вокруг `Next.js` и удобных preview: `Vercel`

## Checklist перед релизом

Перед тем как считать деплой завершенным, проверьте:

- `Supabase` проект создан;
- все env-переменные заполнены;
- `APP_BASE_URL` указывает на реальный production URL;
- миграции применены;
- создан хотя бы один `hotel_admin`;
- приложение открывается по `HTTPS`;
- Telegram integration сохраняется в UI;
- webhook зарегистрирован на правильный URL;
- входящие сообщения доходят до inbox;
- staff видит только свои hotel-scoped данные.

## Rollback

Если выкладка неудачна:

1. верните предыдущую рабочую версию приложения;
2. проверьте совместимость старой версии со свежей схемой БД;
3. если совместимость неочевидна, сначала валидируйте rollback на staging;
4. не меняйте Telegram bot и webhook без явного плана.

## Полезные ссылки

- [Deploy.md](./Deploy.md)
- [LOCAL_SETUP.md](./LOCAL_SETUP.md)
- [Usage.md](./Usage.md)

Внешняя документация:

- Supabase CLI `link`: https://supabase.com/docs/reference/cli/supabase-link
- Supabase CLI `db push`: https://supabase.com/docs/reference/cli/v0/supabase-orgs
- Railway Next.js guide: https://docs.railway.com/guides/nextjs
- Railway variables: https://docs.railway.com/variables
- Railway domains: https://docs.railway.com/networking/domains/working-with-domains
- Render deploys: https://render.com/docs/deploys/
- Render web services: https://render.com/docs/web-services
- Render env vars: https://render.com/docs/configure-environment-variables
- Render custom domains: https://render.com/docs/custom-domains
- Vercel Next.js: https://vercel.com/docs/frameworks/nextjs
- Vercel env vars: https://vercel.com/docs/environment-variables
- Vercel custom domains: https://vercel.com/docs/domains/set-up-custom-domain
- Hetzner server creation: https://docs.hetzner.com/cloud/servers/getting-started/creating-a-server
