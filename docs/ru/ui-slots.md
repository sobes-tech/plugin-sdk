# UI-слоты

[Документация](README.md) | [English](../en/ui-slots.md)

`PluginViewContribution.slot` задаёт место монтирования в приложении. Каждый элемент `manifest.views` содержит уникальный `id`, локализованный `title` и поддерживаемый `slot`. Этот же ID используется в `renderPlugin` или `definePlugin({views})`.

Неизвестный слот приводит к отказу в установке. Плагин не может объявить новую область приложения, заменить встроенный элемент или нативный заголовок окна.

## Рендереры

| | React | Интерфейс, возвращаемый worker |
| --- | --- | --- |
| Файл при сборке | `uiEntrypoint` в `buildPlugin` | `entrypoint` в `buildPlugin` |
| Регистрация | `renderPlugin({viewId: Component})` | `definePlugin({views: {viewId: handler}})` |
| Поле манифеста | `renderer: "react"` | `renderer` не указывается |
| Результат | DOM внутри iframe | JSON-элементы, которые рисует Sobes |
| Состояние | Состояние React, пока существует компонент | Поле `state` результата, которое получит следующий вызов обработчика |
| Окно встречи | Поддерживается | Не поддерживается |

Оба рендерера используют API 1. В одном пакете допустимы React-интерфейсы, worker-команды и обработчики событий. Разрешения на данные не зависят от разрешений на отображение. См. [выполнение и сборку](runtime-and-build.md).

Объявление React-представления:

```ts
import type { PluginViewContribution } from "@sobes-tech/plugin-sdk";

export const view: PluginViewContribution = {
  id: "main",
  title: { en: "Panel", ru: "Панель" },
  slot: "overlay.workspace",
  renderer: "react",
};
```

Для этого объявления нужны `overlay.render` и UI entrypoint с вызовом `renderPlugin({ main: Component })`.

## Страницы и панели главного окна

`app.page` создаёт маршрут `/plugins/:pluginId/:viewId` и занимает основную область окна. Пункт боковой навигации создаётся, если не задано `showInSidebar: false`.

`app.openPage(viewId, query)` открывает `app.page`, объявленную вызывающим плагином. ID плагина подставляет хост. Метод требует `app.navigate`; строковые query-параметры передаются странице через `context.search`.

Остальные слоты главного окна используют переключатели панелей внутри своей области. Панель монтируется при первом открытии. Одновременно видна одна панель на область; закрытие или переключение сохраняет смонтированное содержимое до уничтожения содержащей страницы. Высота ограничена `min(35vh, 20rem)`, превышение прокручивается. См. [размеры и тему](react-ui.md#размеры-и-тема).

## Элементы оверлея

`overlay.toolbar`, `overlay.panel` и `overlay.footer` по умолчанию добавляют кнопку открытия popup: поле `display` отсутствует или равно `"popover"`. Слот определяет начальную позицию элемента. Редактор панели встречи позволяет перемещать, скрывать и менять порядок элементов. Перемещение не меняет рендерер.

Popup закрывается при взаимодействии снаружи или потере фокуса. Escape и кнопка закрытия возвращают фокус на trigger. Внутренний компонент может обработать Escape через `event.preventDefault()`. Обычное закрытие сохраняет iframe.

`display: "inline"` размещает React-интерфейс прямо в нативной строке, без popup и отдельной кнопки хоста. Этот режим поддерживают только `overlay.toolbar`, `overlay.panel`, `overlay.footer`, `overlay.message.header` и `overlay.message.footer`. Он подходит для компактной кнопки действия или переключателя с собственным состоянием плагина. Обработчик задаётся через React `onClick`, состояние переключателя — через `aria-pressed`; протокол действий worker здесь не используется.

Высота встроенного элемента фиксирована по высоте элементов строки. Необязательный `inlineWidth` задаёт ширину целым числом от 24 до 240 CSS-пикселей; по умолчанию — 36 px в панели инструментов или строке ввода и 24 px у сообщения. Прозрачный корень представления должен занимать 100% ширины и высоты. Полный пример React приведён в разделе [встроенные элементы оверлея](react-ui.md#встроенные-элементы-оверлея). Для `inlineWidth` обязательно `display: "inline"`; само поле `display` отклоняется на `overlay.workspace` и во всех слотах вне оверлея.

`overlay.workspace` открывает панель с изменяемым размером: сбоку от содержимого встречи в широком окне и сверху в узком. Взаимодействие снаружи её не закрывает. Одновременно видна одна панель плагина; уже открытые панели остаются смонтированными в пределах текущей встречи.

Содержимое workspace получает `layout: "inline"` и занимает выделенную высоту. Внешние отступы задаёт хост. Управление вкладками заголовка доступно через [useWorkspaceHeaderTabs](react-ui.md#вкладки-в-заголовке-панели-встречи).

## Элементы сообщений

`overlay.message.header` и `overlay.message.footer` добавляют элементы для отдельного сообщения. Видимость настраивается отдельно для ответов, запросов и транскрипций. По умолчанию React-интерфейс монтируется при открытии popup. С `display: "inline"` он отображается прямо в строке элементов сообщения.

Контекст содержит `meetingId`, `messageId` и `messageType`. Текст сообщения в контекст не входит; для него нужен разрешённый вызов API.

## Справочник слотов

Первые 15 слотов требуют `ui.render`. Шесть слотов `overlay.*` требуют `overlay.render`, `renderer: "react"` и UI-бандл.

| Слот | Где появляется |
| --- | --- |
| `app.sidebar.top` | В верхней части боковой панели главного окна |
| `app.sidebar.bottom` | В нижней части боковой панели главного окна |
| `app.page` | На отдельной странице `/plugins/:pluginId/:viewId` |
| `meetings.header` | Над списком встреч |
| `meetings.footer` | Под списком встреч |
| `meeting.header` | В верхней части страницы просмотра встречи |
| `meeting.overview` | В обзоре встречи |
| `meeting.footer` | В нижней части страницы просмотра встречи |
| `meeting.history` | В истории встречи |
| `meeting.gallery` | В галерее встречи |
| `notes.header` | Над интерфейсом заметок |
| `notes.footer` | Под интерфейсом заметок |
| `tracker.header` | Над трекером |
| `tracker.footer` | Под трекером |
| `plugins.installed` | В разделе установленных плагинов |
| `overlay.toolbar` | Кнопка popup или встроенный элемент, изначально в панели инструментов встречи |
| `overlay.workspace` | Панель с изменяемым размером; её кнопка изначально в панели инструментов встречи |
| `overlay.panel` | Кнопка popup или встроенный элемент, изначально в строке ввода сообщения |
| `overlay.footer` | Кнопка popup или встроенный элемент, изначально в строке ввода сообщения |
| `overlay.message.header` | Кнопка popup или встроенный элемент у заголовка сообщения |
| `overlay.message.footer` | Кнопка popup или встроенный элемент под сообщением |

Список слотов также возвращает `api.capabilities`. Поля `order`, иконки и остальные параметры описаны в [манифесте](manifest-and-permissions.md).

## Контекст представления

React получает контекст через `usePlugin().context`, worker через `ctx.context`.

| Место | Поля контекста |
| --- | --- |
| Главное окно | `path`, `search`; в области встречи также `meetingId` |
| Кнопка или панель окна встречи | `meetingId` привязанной встречи |
| Кнопка сообщения | `meetingId`, `messageId`, `messageType`: `"answer"`, `"request"` или `"transcript"` |

Значения имеют тип JSON и проверяются перед использованием. Query-параметры, переданные через `app.openPage`, находятся в `context.search`:

```ts
import type { JsonObject } from "@sobes-tech/plugin-sdk";

export function queryValue(context: JsonObject, key: string): string | null {
  const search = typeof context.search === "string" ? context.search : "";
  return new URLSearchParams(search).get(key);
}
```

В оверлее наличие полей маршрута главного окна не гарантируется. Чтение метаданных оверлея и значения поля сообщения требует `overlay.read`; изменение значения требует `overlay.control`. Эти операции не отправляют сообщение, не запускают запись и генерацию.

Встроенной кнопке, которая меняет только состояние плагина, не нужны `overlay.read` и `overlay.control`. Расположение кнопки не разрешает читать сообщение или управлять встроенными элементами: запрашивайте только разрешения и гранты для её реальных вызовов API.

## Состояние и срок жизни

| Действие пользователя или приложения | Что происходит с React-состоянием |
| --- | --- |
| Повторный рендер, смена языка или темы | Сохраняется |
| Закрытие панели в главном окне | Сохраняется, пока открыта содержащая её страница |
| Закрытие всплывающей панели встречи | Сохраняется, пока существует её кнопка |
| Закрытие или переключение панели `overlay.workspace` | Уже открытые панели сохраняют состояние в пределах этой встречи |
| Уход со страницы, содержащей интерфейс | Iframe может быть уничтожен |
| Смена настроек, обновление, отключение или удаление плагина | Текущая работа останавливается; интерфейс может открыться заново |
| Смена аккаунта, сессии приложения или привязанной встречи | Открытый интерфейс теряет доступ к API; для нового контекста создаётся новый |
| Скрытие кнопки `overlay.workspace` в настройках | Её панель закрывается и удаляется |

React state существует, пока смонтирован iframe. Для данных между монтированиями используются [storage или JSON-файлы](api.md); прочитанные значения проверяются. Worker state передаётся между вызовами явно; см. [выполнение и сборку](runtime-and-build.md).

## Сериализованный UI

Worker-представление возвращает `PluginView` с полями `title`, `blocks` и необязательным `state`, один `PluginBlock` либо ничего. При действии хост снова вызывает обработчик: объект действия передаётся в `ctx.input`, состояние прошлого результата — в `ctx.state`.

У worker нет постоянного React-компонента и DOM. Представление объявляется в слоте главного окна с `ui.render` без поля `renderer`. Для JSX используются `jsxImportSource: "@sobes-tech/plugin-sdk"` и компоненты `/ui`:

```tsx
/** @jsxImportSource @sobes-tech/plugin-sdk */
import { definePlugin } from "@sobes-tech/plugin-sdk";
import { Button, Text } from "@sobes-tech/plugin-sdk/ui";

definePlugin({
  views: {
    main: ctx => ({
      title: "Main",
      blocks: [
        <Text text={JSON.stringify(ctx.input)} />,
        <Button action="refresh" label="Refresh" />,
      ],
      state: ctx.state,
    }),
  },
});
```

React JSX и сериализованный JSX создают разные представления данных. В атрибутах событий сериализованного UI передаются имена действий, не callback-функции.

### Элементы и действия

| Компонент | Поля, которые использует приложение |
| --- | --- |
| `Stack`, `Row` | Дочерние элементы; `style` |
| `Grid` | Дочерние элементы; `columns` от 1 до 6; `style` |
| `Card` | `title`, дочерние элементы; `style` |
| `Text`, `Heading` | `text`, дочерние элементы; `style` |
| `Button` | `label` или дочерние элементы, `action`, `value`, `payload`, `disabled`, `style`; `variant: "outline"` или `"ghost"`, иначе стандартная кнопка |
| `Input` | `label`, `name`, `value`, `action`, `placeholder`, `disabled`; `inputType: "number"` или текст |
| `TextArea` | `label`, `name`, `value`, `action`, `placeholder`, `disabled` |
| `Select` | Поля ввода и `options: {value, label}[]` или массив простых значений |
| `Checkbox` | `label`, `name`, логический `value`, `action`, `disabled` |
| `Table` | `columns`, `rows`, `style`; `action` и `payload` для действия по первой ячейке строки |
| `Image` | `src`, `alt`, `style` |
| `Link` | `label` или дочерние элементы, `href`, `action`, `payload`, `style` |
| `Markdown`, `Code` | `text`, `style` |
| `Badge` | `label` или дочерние элементы, `style` |
| `Divider`, `Spacer` | `style` |
| `Progress` | `value` от 0 до 100, `label`, `style` |
| `Tabs` | `options` с `value`, `label` и необязательным `icon`; выбранный `value`, `action`, `payload`, дочерние элементы, `style` |

Кнопки и вкладки создают `{action, value}` с полями из `payload`. Действие по умолчанию — `"click"`. Ссылка передаёт `href` как `value` и не выполняет переход. Действие таблицы передаёт всю строку как `value`.

Поля создают `{action, name, value}` с действием `"change"` по умолчанию. Checkbox и Select отправляют значение сразу. Текстовые поля отправляют его при blur, Input также при Enter. Числовой Input тоже возвращает строку.

Лимиты рендерера: 200 вариантов Select, 30 колонок таблицы, 200 строк таблицы, 10 000 символов Input и 100 000 символов TextArea. Heading создаёт `h3`. Сериализованный Markdown не открывает ссылки и не загружает удалённые изображения. Для формул, подсветки кода и собственных рендереров доступен React-компонент [MarkdownRenderer](react-ui.md#markdown).

### Допустимые стили

`style` — JSON-объект. Неподдерживаемые свойства игнорируются.

| Свойства | Значения |
| --- | --- |
| `width`, `maxWidth`, `minWidth`, `height`, `maxHeight`, `minHeight`, `padding`, `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight`, `gap`, `borderRadius`, `fontSize`, `fontWeight`, `opacity` | Конечные числа от 0 до 2 000 |
| `color`, `backgroundColor`, `borderColor` | HEX-цвета или `var(--foreground)`, `var(--background)`, `var(--primary)`, `var(--muted)`, `var(--muted-foreground)`, `var(--card)`, `var(--border)`, `var(--destructive)` |
| `textAlign` | `"left"`, `"center"` или `"right"` |

Изображения принимают base64 data URL форматов PNG, JPEG, WebP, GIF и BMP длиной менее 12 MiB. На весь результат распространяются [лимиты runtime](runtime-and-build.md).

### JSX runtime

Импорт: `@sobes-tech/plugin-sdk/jsx-runtime`. Из `@sobes-tech/plugin-sdk/jsx-dev-runtime` экспортируются те же функции.

| Экспорт | Что возвращает |
| --- | --- |
| `jsx(type: PluginElementTag \| Component, values: ElementProps \| null): PluginBlock` | Для тега создаёт `{type: "element", tag, props, children}`; `null` в props заменяется пустым объектом. Если `type` является функцией-компонентом, вызывает её с props. |
| `jsxs`, `jsxDEV` | Та же функция `jsx`, с теми же проверками |
| `Fragment` | Элемент `stack`, поэтому `<>...</>` в этом JSX добавляет вертикальный контейнер |

Массивы children рекурсивно разворачиваются. Строки и числа становятся текстовыми блоками. `boolean`, `null` и `undefined` пропускаются; готовые `PluginBlock` сохраняются. Функция в атрибуте тега приводит к ошибке. Функция допустима как `type` компонента, поскольку вызывается до сериализации.

`Child` описывает дочерние значения. `ElementProps` сопоставляет именам свойств JSON, children или `undefined`. `Component` возвращает `PluginBlock`; `JSX.Element` также равен `PluginBlock`. Встроенные теги ограничены `PluginElementTag`.
