# Code Explainer / Разбор кода

A React plugin that calls an OpenAI-compatible chat-completions API through `createPluginFetch`.

## English

Build `examples/bundles/code-explainer.json` and install it through **Plugins → Installed → Install from file**. Allow access to `api.openai.com`. In the installed plugin settings, enter your API key, model ID and full chat-completions URL. The example defaults to `https://api.openai.com/v1/chat/completions`.

Open **Code Explainer**, paste code, optionally add a question, and click **Explain code**. The plugin sends only those two text fields. The answer appears as streamed Markdown. **Stop** cancels the HTTP request and keeps the text already received. Closing the page aborts the request. A new click starts a new request; the example has no resume or server operation history.

The provider settings belong to this plugin. It does not use models, keys or generation APIs from the application. The API-key field is masked, but all settings are stored in local JSON without encryption. Never include real keys in the manifest or source code.

This example pins `api.openai.com` in `manifest.networkDomains` and in its URL validation. To use another provider, update those checks, rebuild and install the changed package. General plugins can use the [documented wildcard rules](../../docs/en/network.md#declare-access) for configurable providers. The example expects the OpenAI chat-completions SSE format; another protocol needs an adapted parser.

Code is limited to 32,000 characters, the question to 1,000, and the request asks for at most 2,048 output tokens. It does not read account data or execute code. Review any suggested code changes yourself.

## Русский

Соберите `examples/bundles/code-explainer.json` и установите через **Плагины → Установленные → Установить из файла**. Разрешите доступ к `api.openai.com`. В настройках установленного плагина укажите API-ключ, ID модели и полный URL chat-completions. По умолчанию используется `https://api.openai.com/v1/chat/completions`.

Откройте **Разбор кода**, вставьте код, при необходимости добавьте вопрос и нажмите **Разобрать код**. Плагин отправляет только эти два текстовых поля. Ответ появляется постепенно в Markdown. **Остановить** отменяет HTTP-запрос и сохраняет полученную часть ответа. Закрытие страницы тоже отменяет запрос. Следующее нажатие создаёт новый запрос: восстановления соединения и серверной истории операций в примере нет.

Настройки провайдера принадлежат этому плагину. Он не использует модели, ключи и API генерации приложения. Поле ключа скрывает символы, но все настройки хранятся в локальном JSON без шифрования. Реальные ключи нельзя включать в манифест и исходники.

В этом примере `api.openai.com` закреплён в `manifest.networkDomains` и проверке URL. Для другого провайдера измените эти проверки, пересоберите и установите пакет. В других плагинах для настраиваемого провайдера можно использовать [маски доменов](../../docs/ru/network.md#разрешить-домены). Пример ожидает SSE в формате OpenAI chat-completions; другой протокол потребует изменения парсера.

Ограничения: 32 000 символов кода, 1 000 символов вопроса и запрос на максимум 2 048 токенов ответа. Плагин не читает данные аккаунта и не выполняет код. Предложенные изменения проверяйте самостоятельно.

## Build and test

```sh
bun run build:examples
bun run test:examples
bun run typecheck
bun run lint
```

The example imports SDK sources relatively. A separate plugin uses `@sobes-tech/plugin-sdk`, `@sobes-tech/plugin-sdk/react`, `@sobes-tech/plugin-sdk/components` and `@sobes-tech/plugin-sdk/markdown`.
