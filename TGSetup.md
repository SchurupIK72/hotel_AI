Что вы уже можете сделать сейчас:

поднять локальный проект
npm.cmd run dev:setup
открыть settings
http://localhost:3000/dashboard/settings/telegram
ввести:
Integration name
Bot token из @BotFather
optional Webhook secret
нажать Verify and connect bot
После этого система:

проверит токен через Telegram getMe
сохранит integration
покажет Webhook URL
Что пока не стоит делать:

не переводите бота в live webhook mode для реальных гостей
не рассчитывайте, что сообщения из Telegram попадут в inbox
route сейчас только валидирует endpoint и secret, но не ingests updates
Если хотите просто проверить, что bot token валидный:

этого уже достаточно через форму settings
Если хотите именно “запустить бота” в смысле начать принимать сообщения от пользователей, то нужен следующий этап:

реализовать PH1-03 Inbound messaging ingestion
Если хотите, я следующим сообщением дам вам короткую пошаговую инструкцию:

как создать бота через @BotFather
где взять token
как проверить его в текущем UI проекта
как потом будем подключать webhook на PH1-03.

как проверить его в текущем UI проекта



Открой локально страницу:

http://localhost:3000/dashboard/settings/telegram
Дальше:

Войди под demo user или своим staff-аккаунтом с ролью hotel_admin.
В блоке Connect Telegram bot или Rotate or update Telegram bot заполни:
Integration name
Bot token
Webhook secret — опционально
Нажми Verify and connect bot или Verify and save changes.
Что должно произойти:

сервер вызовет Telegram getMe
если токен валидный, сверху появится green success message
на странице заполнятся:
Bot username
Status
Last verified
Webhook URL
Endpoint status = reserved_endpoint_only
Если токен невалидный:

появится red error message
ниже может показаться Latest verification error
Что именно вы этим проверяете сейчас:

токен настоящий и принадлежит bot account
integration сохраняется в базе
секрет не показывается обратно в UI
webhook URL корректно генерируется
Что вы пока не проверяете:

прием сообщений от пользователей
создание conversation/message records
живую работу webhook ingestion
То есть сейчас UI подходит для проверки token + save + verify, но не для end-to-end общения с ботом.

Если хотите, я следующим сообщением дам короткий checklist “какие поля на странице должны измениться после успешной проверки токена”.