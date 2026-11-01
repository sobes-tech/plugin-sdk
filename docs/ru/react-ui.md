# React API

[Документация](README.md) | [English](../en/react-ui.md)

Хуки экспортируются из `@sobes-tech/plugin-sdk/react`, компоненты из `@sobes-tech/plugin-sdk/components`. React-интерфейс выполняется в изолированном iframe. В `manifest.views` задаются `renderer: "react"`, поддерживаемый слот и разрешение на отображение; исходник передаётся в `buildPlugin` через `uiEntrypoint`.

## Регистрация представления

`renderPlugin` связывает ID представлений с React-компонентами. Ключ объекта должен совпадать с `views[].id`. Функция вызывается один раз в UI entrypoint:

```tsx
import { renderPlugin, usePlugin } from "@sobes-tech/plugin-sdk/react";

function Main() {
  const { locale } = usePlugin();
  return <output>{locale}</output>;
}

renderPlugin({ main: Main });
```

Хост выбирает компонент по `environment.viewId`. Отсутствующий ключ приводит к ошибке `Unknown plugin view`. Для `renderPlugin` нужен мост хоста; результат функции позволяет размонтировать интерфейс.

| Функция из `@sobes-tech/plugin-sdk/react` | Для чего нужна |
| --- | --- |
| `renderPlugin(views: Record<string, ComponentType>): () => void` | Один раз регистрирует компоненты UI-файла и монтирует выбранный приложением экран. Возвращает функцию размонтирования. |
| `usePlugin(): ReactPluginContext` | Даёт компоненту основной API и актуальное окружение. Работает внутри дерева, созданного `renderPlugin`. |
| `useWorkspaceHeaderTabs(options: WorkspaceHeaderTabsOptions): boolean` | Передаёт вкладки в заголовок панели и возвращает признак поддержки контейнером. |
| `usePluginApi(): PluginApi` | Даёт клиент [API приложения](platform/README.md). Перед вызовом проверяйте поддержку нужной возможности приложением. |

## Окружение

`ReactPluginContext` объединяет клиент основного API и `PluginEnvironment`. При смене языка, темы или контекста хост обновляет окружение, а `usePlugin()` возвращает новые значения при следующем рендере.

| Поле | Значение |
| --- | --- |
| `viewId` | `id` открытого экрана из манифеста |
| `locale` | `"en" \| "ru"` |
| `theme` | `"dark" \| "light"` |
| `settings` | Сохранённые настройки манифеста: `Record<string, string \| boolean>`. Изменение объекта в компоненте их не сохраняет. |
| `context` | JSON с идентификаторами и маршрутом; состав зависит от [места открытия](ui-slots.md#контекст-представления) |
| `layout` | Необязательный `"page" \| "inline" \| "control"`: отдельная страница, встроенная область или компактный элемент оверлея |
| `workspace` | Необязательный `{headerTabs: true}`: приложение умеет показывать вкладки этой панели в своём заголовке |

`context` имеет тип `JsonObject`. Состав полей зависит от [слота](ui-slots.md#контекст-представления); перед использованием проверяется тип значения. Идентификатор ресурса сам по себе не даёт права его читать.

В React нет аргументов worker `input`, `state` и метода `meeting.getSelected()`. Объект `files` имеет тип `PluginFiles` без метода `files.exportText()`. Остальные методы основного API проходят те же проверки разрешений, что и вызовы worker.

## Размеры и тема

Viewport iframe равен выделенной области интерфейса. Максимальная ширина содержимого `Page` — 860 px; `width="full"` снимает это ограничение. При ширине viewport до 640 px `Grid` использует одну колонку.

Хост задаёт `--sobes-content-padding`: 20 px для `layout: "page"`, 16 px при ширине до 640 px и 0 px для `layout: "inline"` или `layout: "control"`. У встроенных панелей внешние отступы задаёт контейнер. Переменную можно переопределить в CSS плагина.

Корень iframe прозрачен. Цвета доступны через CSS-переменные `--foreground`, `--background`, `--primary`, `--muted-foreground`, `--card`, `--border`, `--input` и `--ring`. Они обновляются вместе с темой. Для переменных, доступных не во всех контейнерах, задаётся fallback, например `var(--popover, var(--card))`.

`overlay.workspace` занимает выделенную ему высоту. Прокручиваемому дочернему элементу во flex-контейнере нужен `min-height: 0`:

```css
.panel { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.panel-header { flex: none; }
.panel-content { flex: 1; min-height: 0; overflow: auto; }
```

URL iframe не является маршрутом приложения. Локальная навигация хранится в React state или роутере с историей в памяти. Переход на другую объявленную страницу плагина выполняется через `app.openPage`.

## Встроенные элементы оверлея

Пять компактных слотов оверлея поддерживают `display: "inline"`: `overlay.toolbar`, `overlay.panel`, `overlay.footer`, `overlay.message.header` и `overlay.message.footer`. React-интерфейс сам становится элементом нативной строки, без popup и отдельной кнопки открытия. Например, объявите это представление с `permissions: ["overlay.render"]`:

```ts
{
  id: "mark",
  title: { en: "Mark meeting", ru: "Отметить встречу" },
  slot: "overlay.toolbar",
  renderer: "react",
  display: "inline",
  inlineWidth: 36,
}
```

Хост передаёт `layout: "control"` и фиксирует высоту: 32 px в панели инструментов и строке ввода, 24 px у сообщения. `inlineWidth` — целое число от 24 до 240 CSS-пикселей; без него ширина равна 36 px или 24 px соответственно. Поле `display` не допускается у `overlay.workspace` и слотов вне оверлея, а для `inlineWidth` обязательно `display: "inline"`. Без `display` компактный слот оверлея сохраняет поведение popup.

Используйте SDK `Button` с иконкой без видимого текста, доступной подписью и `title`. Состояние переключателя принадлежит плагину; обычное действие использует такой же React `onClick`, но без `aria-pressed`:

```tsx
import { useState } from "react";
import { renderPlugin, usePlugin } from "@sobes-tech/plugin-sdk/react";
import { Button } from "@sobes-tech/plugin-sdk/components";
import "./style.css";

function MarkControl() {
  const { locale } = usePlugin();
  const [marked, setMarked] = useState(false);
  const label = locale === "ru"
    ? (marked ? "Снять отметку" : "Отметить встречу")
    : (marked ? "Unmark meeting" : "Mark meeting");

  return <div className="inline-control">
    <Button variant={marked ? "secondary" : "ghost"} size="icon"
      aria-label={label} title={label} aria-pressed={marked}
      onClick={() => setMarked(value => !value)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m5 12 4 4L19 6" />
      </svg>
    </Button>
  </div>;
}

renderPlugin({ mark: MarkControl });
```

```css
.inline-control { width: 100%; height: 100%; min-width: 0; min-height: 0; background: transparent; }
.inline-control > button { width: 100%; height: 100%; min-height: 0; padding: 0; }
```

Хост растягивает `html`, `body` и `#root` на высоту элемента и скрывает выходящее за границы содержимое. Сохраняйте прозрачный корень и вписывайте содержимое в доступную ширину и высоту. Порталы остаются внутри iframe и обрезаются; для меню и большого содержимого используйте `display: "popover"`. Значение `layout: "inline"` у workspace обозначает другой тип размещения и не превращает его в компактный элемент.

Пример меняет только React state, который живёт, пока смонтирован iframe. Для постоянного поведения используйте хранилище плагина или разрешённые API. Встроенный режим не использует сообщения worker `{action, value}`; для переключения локального состояния не нужны `overlay.read` и `overlay.control`. Каждый вызов API требует соответствующего разрешения или гранта.

## Состояние при закрытии

React state сохраняется между рендерами и существует, пока смонтирован iframe. Скрытие открытого popup или переключение между посещёнными workspace-панелями сохраняет их iframe. Навигация, изменение настроек, обновление пакета, отключение, смена аккаунта, сессии или встречи могут пересоздать интерфейс. См. [срок жизни](ui-slots.md#состояние-и-срок-жизни).

React state не является постоянным хранилищем. Для данных между монтированиями используются `storage` или `files`; прочитанные значения требуют проверки. Cleanup асинхронного обработчика должен прекращать обновление state после unmount, но не отменяет уже выполняющуюся операцию хоста.

## Вкладки в заголовке панели встречи

`useWorkspaceHeaderTabs(options): boolean` передаёт вкладки в заголовок `overlay.workspace`. Возвращает `true`, если контейнер предоставляет управление вкладками, иначе `false`.

| Поле хука | Тип и ограничения |
| --- | --- |
| `items` | `readonly {id: string, label: string}[]`. Не больше восьми элементов. ID уникальные, непустые, до 64 кодовых единиц UTF-16. Подписи непустые, до 80 единиц. Управляющие ASCII-символы запрещены. |
| `value` | `string`, совпадающая с ID одного из элементов |
| `onValueChange` | `(id: string) => void`, обновляет выбранный раздел |

`WorkspaceHeaderTab` имеет форму `{ id: string; label: string }`. `WorkspaceHeaderTabsConfig` содержит `items` и `value`; `WorkspaceHeaderTabsOptions` также требует `onValueChange`. Подпись — строка на текущем языке, не объект локализации и не JSX. Выбранное значение контролирует плагин.

```tsx
import { useState } from "react";
import { useWorkspaceHeaderTabs } from "@sobes-tech/plugin-sdk/react";
import { Tabs } from "@sobes-tech/plugin-sdk/components";

export function TabbedView() {
  const [value, setValue] = useState("first");
  const items = [{ id: "first", label: "Первый" }, { id: "second", label: "Второй" }];
  const inHeader = useWorkspaceHeaderTabs({ items, value, onValueChange: setValue });
  return <>
    {!inHeader && <Tabs items={items.map(item => ({ value: item.id, label: item.label }))}
      value={value} onValueChange={setValue} />}
    <output>{value}</output>
  </>;
}
```

Заголовок поддерживает ArrowLeft, ArrowRight, Home и End. Изменение подписей и выбранной вкладки не пересоздаёт компонент. Кнопка закрытия остаётся у хоста. Unmount удаляет вкладки; `items: []` с `value: ""` очищает их явно. Дополнительное разрешение сверх разрешения на отображение не требуется.

## Справочник компонентов

Импорт компонентов подключает их CSS. Если не указано иное, поддерживаются `children`, `className`, `style`, ARIA-атрибуты и стандартные атрибуты соответствующего DOM-элемента. `Progress`, `EmptyState` и `Tabs` принимают только перечисленные props. `Input`, `Textarea`, `Checkbox`, `Select` и `Button` передают ref DOM-элементу. Экспортируются типы `ButtonProps`, `SelectProps`, `SelectOption`, `TabItem`, `Tone` и `MarkdownRendererProps`.

Экспорты из `@sobes-tech/plugin-sdk/ui` создают [сериализованные блоки](ui-slots.md#сериализованный-ui), а не React-компоненты.

### Контейнеры и текст

| Компонент | Элемент | Собственные поля и значения по умолчанию |
| --- | --- | --- |
| `Page` | `div` | `width?: "content" \| "full" = "content"` |
| `Stack` | `div` | `gap?: number = 16` |
| `Row` | `div` | `gap?: number = 8`, `wrap?: boolean = true` |
| `Grid` | `div` | `columns?: number = 2`, от 1 до 6; `gap?: number = 16` |
| `PageHeader` | `header` | Обязательный `title: ReactNode`; `description?: ReactNode`, `actions?: ReactNode` |
| `Card` | `section` | Стандартные атрибуты section |
| `CardHeader`, `CardContent` | `div` | Стандартные атрибуты div |
| `Heading` | От `h1` до `h4` | `level?: 1 \| 2 \| 3 \| 4 = 2` |
| `Text` | `p` | `muted?: boolean = false`, `small?: boolean = false` |
| `Separator` | `hr` | Стандартные атрибуты hr |

`gap` задаётся в CSS-пикселях. `Grid.columns` ограничивается диапазоном 1..6. `Table` оборачивает обычную таблицу в контейнер с горизонтальной прокруткой; в children передаются `thead`, `tbody`, `tr`, `th` и `td`.

### Действия и состояния

| Компонент | Элемент | Собственные поля и значения по умолчанию |
| --- | --- | --- |
| `Button` | `button` | `variant?: "primary" \| "secondary" \| "outline" \| "ghost" \| "danger" = "primary"`; `size?: "sm" \| "md" \| "lg" \| "icon" = "md"`; `busy?: boolean`; `type` по умолчанию `"button"` |
| `Pill` | `span` | `tone?: Tone = "neutral"`; `onRemove?: () => void`, `removeLabel?: string = "Remove"` |
| `Badge` | `span` | `tone?: Tone = "neutral"` |
| `TogglePill` | `button` | Обязательный `selected: boolean`; стандартные атрибуты button; `type` по умолчанию `"button"` |
| `Switch` | `button` | Обязательные `checked: boolean`, `onCheckedChange: (checked: boolean) => void`; атрибуты button, кроме `type` и `role` |
| `Spinner` | `span` | `label?: string = "Loading"`; стандартные атрибуты span |
| `Progress` | `progress` | Обязательные `value: number`, `label: string`; `max?: number = 100` |
| `EmptyState` | `div` | Обязательный `title: ReactNode`; `description?: ReactNode`, `icon?: ReactNode`, `actions?: ReactNode`, `className?: string` |

`Tone`: `"neutral" | "success" | "warning" | "danger" | "info" | "accent"`.

`Button.busy` отключает кнопку и показывает Spinner. `Pill.onRemove` добавляет кнопку удаления. `TogglePill` задаёт `aria-pressed`; `Switch` задаёт `role="switch"` и `aria-checked`. Обработчик `Switch.onClick` может отменить изменение через `event.preventDefault()`.

Пустой `Spinner.label` скрывает индикатор от вспомогательных технологий. `Progress` ограничивает `value` диапазоном 0..max; некорректный `max` заменяет на 100, неконечный `value` на 0.

### Поля ввода

| Компонент | Элемент и ref | Собственные поля |
| --- | --- | --- |
| `Input` | `input`, `HTMLInputElement` | Стандартные атрибуты input |
| `Textarea` | `textarea`, `HTMLTextAreaElement` | Стандартные атрибуты textarea |
| `Checkbox` | Checkbox input, `HTMLInputElement` | Атрибуты input, кроме `type` |
| `Field` | `div` | Обязательные `label: ReactNode` и один React-элемент в children; `description?: ReactNode`, `error?: ReactNode`, `controlId?: string`; атрибуты div, кроме `children` |
| `Select` | Кнопка, `HTMLButtonElement` | См. ниже |

`Field` использует `controlId`, `id` дочернего элемента или сгенерированный ID, в этом порядке. Существующий `aria-describedby` сохраняется и дополняется ID подсказки. `error` заменяет `description`, задаёт полю `aria-invalid` и сообщению `role="alert"`. Значение проверяет вызывающий код.

Минимальная высота `Input` и `Select` — 36 px. Минимальная высота `Textarea` — 100 px; поддерживается вертикальное изменение размера.

### Select

`Select` поддерживает одиночный выбор через React-popup внутри iframe без системного меню ОС. Ref указывает на кнопку `HTMLButtonElement`.

| Поле | Тип и значение по умолчанию |
| --- | --- |
| `options` | Обязательный `readonly SelectOption[]` |
| `value` | Строка, если выбранное значение хранит родительский компонент |
| `defaultValue` | Начальное значение, если выбор хранит сам Select; по умолчанию `""` |
| `onValueChange` | Необязательный `(value: string) => void` |
| `placeholder` | Необязательный `ReactNode`; по умолчанию `"Select…"` |
| `name`, `form` | Необязательные строки для отправки значения и привязки к форме |
| `required`, `disabled` | Необязательные логические значения |
| `dir` | Необязательный `"ltr" \| "rtl"` |
| `onOpenChange` | Необязательный `(open: boolean) => void` |

`SelectOption`: `{ value: string; label: ReactNode; disabled?: boolean; textValue?: string }`. Значения — уникальные непустые строки. Пустая строка означает отсутствие выбора. `textValue` задаёт текст для поиска с клавиатуры, если label содержит не только текст.

`onValueChange` получает выбранную строку. Стандартные атрибуты кнопки применяются к trigger. `children`, `onChange`, `multiple`, `size` и `type` не поддерживаются. Пустой список options отключает компонент. Для uncontrolled Select сброс формы восстанавливает начальное `defaultValue`. При `required` пустое значение блокирует отправку формы.

Клавиатура: стрелки, Home, End, поиск набором текста, Enter, Space и Escape. Отключённые варианты пропускаются. Popup монтируется в body iframe, выбирает доступную сторону и прокручивается внутри viewport; за пределы iframe не выходит. Встроенная панель может резервировать место под меню в пределах лимита высоты хоста.

### Tabs и Table

`Tabs` требует `items: TabItem[]`, `value: string` и `onValueChange: (value: string) => void`. Необязательные props: `label?: string = "Tabs"` и `className?: string`.

`TabItem`: `{ value: string; label: ReactNode; icon?: ReactNode; disabled?: boolean; content?: ReactNode }`. Для элементов с `content` создаётся панель; неактивные панели остаются смонтированными с `hidden`. Если выбранного значения нет, отображается первый включённый элемент. Клавиатура: ArrowLeft, ArrowRight, Home и End.

`Table` принимает атрибуты table, `children` и `className`; внешний контейнер обеспечивает горизонтальную прокрутку.

## Markdown

`MarkdownRenderer` экспортируется из `@sobes-tech/plugin-sdk/components` и `@sobes-tech/plugin-sdk/markdown`. `MarkdownRendererExtended` — тот же компонент.

| Поле | Тип и значение по умолчанию |
| --- | --- |
| `content` | Обязательный `string \| string[] \| null \| undefined`; строки массива соединяются без разделителя |
| `answerHighlights` | `boolean = true` |
| `isStreaming` | `boolean = false` |
| `allowSafeHtml` | `boolean = false` |
| `className`, `style` | CSS-класс и объект CSS-свойств React |
| `componentOverrides` | `Partial<Components>` из `react-markdown` |
| `onOpenLink` | Необязательный `(url: string) => void` |

Поддерживаются GFM-таблицы, списки задач, подсветка кода, строчный и блочный LaTeX, `<br>` и маркеры `[[m:...]]`, `[[t:...]]`, `[[e:...]]`, `[[c:...]]`. В блоках кода маркеры остаются текстом. `isStreaming` скрывает незавершённый маркер в конце строки и не запускает генерацию. Шрифты KaTeX и ресурсы подсветки включены в пакет.

Переход по ссылке блокируется по умолчанию. `onOpenLink` получает URL; вызов `app.openExternal` требует соответствующего разрешения:

```tsx
import { usePlugin } from "@sobes-tech/plugin-sdk/react";
import { MarkdownRenderer } from "@sobes-tech/plugin-sdk/components";

export function Content({ value, onError }: { value: string; onError: (error: unknown) => void }) {
  const { app } = usePlugin();
  return <MarkdownRenderer content={value}
    onOpenLink={url => { void app.openExternal(url).catch(onError); }} />;
}
```

Стандартный рендерер изображений принимает base64 data URL для PNG, JPEG, GIF, WebP и blob URL. Для других источников отображается alt-текст. `allowSafeHtml` включает HTML после удаления скриптов, обработчиков событий, iframe и стилей. `componentOverrides` заменяет рендереры, сохраняя ограничения доступа iframe.

### Markdown helpers

Импорт: `@sobes-tech/plugin-sdk/markdown-core`. Фабрики remark/rehype возвращают обработчики, изменяющие переданное дерево; строковые функции возвращают новую строку.

| Экспорт | Что делает |
| --- | --- |
| `remarkAnswerHighlights()` | Возвращает обработчик remark для маркеров `[[m:...]]`, `[[t:...]]`, `[[e:...]]`, `[[c:...]]`. Создаёт узлы `answerHighlight`, которые становятся `mark` с `data-hl`. Маркер действует внутри одного родительского узла и может остаться открытым до его конца. Закрывающий маркер без открывающего остаётся текстом. Узлы кода, строчного кода, формул и HTML пропускаются. |
| `trimPartialAnswerHighlight(content: string): string` | Убирает `[[`, `[[m`, `[[t`, `[[e` или `[[c` в самом конце строки. Используется для постепенно поступающего текста. Markdown не разбирает, поэтому отдельно области кода не распознаёт. |
| `rehypeRawLineBreaks()` | Возвращает обработчик rehype, который превращает raw HTML с `<br>` и текстом в узлы `br` и текста. Заменяет raw-потомков родителя, только если каждый из них содержит `<br>` и не содержит других HTML-тегов. Остальной HTML не меняет; это не функция очистки HTML. |
| `normalizeMathDelimiters(content: string): string` | Превращает `\[...\]` в блок `$$`, а `\(...\)` в `$...$`, убирая пробелы по краям внутри разделителей. Не меняет блоки в тройных обратных кавычках, блоки с тройной тильдой и фрагменты в одинарных обратных кавычках. |
