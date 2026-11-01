# Crash Test / Проверка сбоев

## English

This example checks how the desktop host handles failures inside a plugin. It requests only `ui.render` and has no network access, account-data grants, file operations or native API calls. Installing it or opening its page does not trigger a failure. Every test requires a deliberate user action.

Build `examples/bundles/crash-test.json` and install it through **Plugins → Installed → Install from file**. Open **Crash Test** from the main navigation for the browser tests:

- **Throw a synchronous error** throws from a React click handler.
- **Create an unhandled rejection** rejects a Promise without a catch handler, so the host can exercise its unhandled-rejection reporting.

Open this plugin's installed settings for the worker tests:

- **Test worker exception** throws from the selected worker command.
- **Test worker timeout** runs an allocation-free infinite loop in that command's isolated worker process. It makes no host calls. The normal uninterrupted QuickJS limit, currently two seconds, should interrupt it; the overall worker deadline remains unchanged. Do not run this command in an unrestricted JavaScript runtime.

Expected behavior: the host reports the error or timeout for this plugin, the failed invocation ends, and the main application and other plugins remain usable. The UI may show the host's plugin error state; reopen the page or use the host's reload control before trying the next test. Worker failures should not require restarting the application. These are expectations for manual validation, not claims proven by typechecking or bundling.

No test allocates unbounded memory, starts a browser main-thread loop or attempts to crash a native process. Run only the chosen test and record the host version, trigger, visible error and whether unrelated UI remains usable.

## Русский

Пример проверяет, как десктопный хост обрабатывает сбои внутри плагина. Единственное разрешение — `ui.render`; нет доступа к сети, данным аккаунта, файловых операций и вызовов нативных API. Установка и открытие страницы не запускают сбой. Каждая проверка требует явного действия пользователя.

Соберите `examples/bundles/crash-test.json` и установите через **Плагины → Установленные → Установить из файла**. Откройте **Проверка сбоев** в главной навигации для проверок браузерного интерфейса:

- **Вызвать синхронную ошибку** выбрасывает исключение из обработчика нажатия React.
- **Отклонить Promise без обработчика** создаёт отклонённый Promise без `catch`, чтобы проверить регистрацию необработанных отклонений хостом.

Для проверок worker откройте настройки установленного плагина:

- **Проверить ошибку worker** выбрасывает исключение из выбранной команды worker.
- **Проверить таймаут worker** запускает бесконечный цикл без выделения памяти в отдельном процессе выбранной команды. Цикл не вызывает API хоста. Его должен прервать обычный лимит непрерывного выполнения QuickJS, сейчас две секунды; общий дедлайн worker не меняется. Не запускайте эту команду в JavaScript-среде без лимита выполнения.

Ожидаемое поведение: хост сообщает об ошибке или таймауте этого плагина, завершает неудачный вызов, а главное приложение и другие плагины продолжают работать. Интерфейс может перейти в состояние ошибки плагина; перед следующей проверкой откройте страницу заново или используйте перезагрузку, предоставленную хостом. Ошибка worker не должна требовать перезапуска приложения. Это ожидания для ручной проверки, а не результат проверки типов или сборки.

Проверки не выделяют неограниченную память, не запускают цикл в главном потоке браузера и не пытаются аварийно завершить нативный процесс. Запускайте только выбранную проверку и фиксируйте версию хоста, действие, видимую ошибку и работоспособность остального интерфейса.

## Build

```sh
bun run build:examples
bun run typecheck
bun run lint
```

The UI entrypoint is `index.tsx`; the worker entrypoint is `worker.ts`. `build.ts` bundles both into one package. Importing and building the source registers handlers but never invokes a crash trigger.
