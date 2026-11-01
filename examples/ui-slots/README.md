# UI Slots

A diagnostic plugin covering the host's **21 UI slots**, with two additional inline controls. Each original view shows its slot ID, placement instructions, theme, optional host-provided context and a local click counter. The `app.page` view also lists all slots and where to find them. Labels follow the app's English or Russian locale.

The plugin requests only `ui.render` and `overlay.render`. It makes no host API requests, reads no meeting or note contents, writes no data, uses no models and makes no network requests. The context panel displays only the environment already passed to the view by the host. Counters are not persisted; the host may keep a mounted panel alive while it is closed, but navigation or reinstallation can reset it.

## Build and install

From the SDK repository root:

```sh
bun install --frozen-lockfile
bun examples/ui-slots/build.ts
```

Or run `bun run build:examples` to build every example. The ready-to-install package is [`../bundles/ui-slots.json`](../bundles/ui-slots.json).

In a compatible Sobes desktop build, open **Plugins → Installed → Install from file**, select `ui-slots.json`, review both rendering permissions and install it. Enable the plugin if it is disabled. Open **UI Slots** in the main navigation for the placement guide.

## Check every slot

Main-window extensions use the host's compact selector. Select the **UI Slots** entry to open the actual marker; its hover tooltip and opened panel identify the slot. Registering the view does not force its panel open.

| Screen | Slots | Visibility |
| --- | --- | --- |
| Main navigation | `app.sidebar.top`, `app.sidebar.bottom` | Use a main application page; the settings sidebar does not contain these slots. |
| UI Slots page | `app.page` | Open the plugin's entry in the main navigation. |
| Meetings list | `meetings.header`, `meetings.footer` | Above and below the list. |
| Meeting preview | `meeting.header`, `meeting.footer` | Open a meeting. |
| Meeting preview → Summary | `meeting.overview` | Wait for the meeting to load successfully. |
| Meeting preview → History | `meeting.history` | Wait for messages to load; the history must contain a message. |
| Meeting preview → Gallery | `meeting.gallery` | Wait for screenshots to load; the gallery must contain a screenshot. |
| Notes | `notes.header`, `notes.footer` | Above and below the notes UI. |
| Tracker | `tracker.header`, `tracker.footer` | Above and below the board. |
| Plugins → Installed | `plugins.installed` | Below the installed plugin list. |
| Active meeting overlay | `overlay.toolbar`, `overlay.panel`, `overlay.footer` | Open each control's popup. Toolbar starts in the toolbar; panel and footer start in the composer. The Meeting Panel editor can move or hide them. |
| Active meeting workspace | `overlay.workspace` | Open its control to show the docked panel, then resize it. Its control starts in the toolbar and can be moved or hidden in the Meeting Panel editor. Closing or switching panels retains the counter within the current meeting. |
| Active meeting overlay messages | `overlay.message.header`, `overlay.message.footer` | Open a control beside an existing message. Check per-message-type visibility settings for answers, requests and transcripts. |

Click **Test click** in each marker to verify that its React UI handles input. The placement guide lists declared contributions; it does not claim that every screen has been opened or tested. Slots on different pages, tabs and windows cannot all be displayed at once.

## Inline controls

The extra `inline-toggle` view appears directly in the meeting toolbar as a power icon. Press it to toggle its local mode; `aria-pressed`, the accent color and its tooltip expose the current state. The extra `inline-action` view appears directly in a message footer as a plus icon. Each press increments a local counter shown in the tooltip. Both buttons have stable accessible labels. These are ordinary React buttons, with no popup or worker action protocol.

Both declare `display: "inline"` and omit `inlineWidth`, using the host defaults: 36 px wide and 32 px high in the toolbar, 24 px wide and high beside a message. The iframe has `layout: "control"`; the transparent root and icon button fill it without padding. The host clips overflow, including portals; use the default popover display for menus. The original 21 slot views remain unchanged, giving 23 views total.

### Встроенные элементы

Дополнительное представление `inline-toggle` показывает значок питания прямо на панели инструментов встречи. Нажатие переключает локальный режим; `aria-pressed`, цвет и подсказка отражают состояние. `inline-action` показывает плюс под сообщением: каждое нажатие увеличивает локальный счётчик в подсказке. У обеих кнопок стабильные доступные подписи. Это обычные React-кнопки без попапа и протокола действий worker.

У обоих элементов задан `display: "inline"`, а `inlineWidth` не указан. Хост выделяет ширину 36 px и высоту 32 px на панели инструментов, 24 × 24 px рядом с сообщением. Iframe получает `layout: "control"`; прозрачный корень и кнопка заполняют его без отступов. Содержимое за границами iframe, включая порталы, обрезается; для меню используйте попап. Все 21 исходное представление сохранены, всего их 23.

## How it works

[`manifest.ts`](manifest.ts) holds a `Record<PluginSlot, LocalizedText>` and derives one view per key. TypeScript reports a missing entry if the SDK gains a slot. Those view IDs equal slot IDs; `inlineViews` adds the toggle and action. The page's navigation title is **UI Slots**. All views use `renderer: "react"`, including the six overlay slots that require it.

[`index.tsx`](index.tsx) registers all view components with `renderPlugin` and reads locale, theme and context with `usePlugin`. Each marker and inline control has its own local state. [`style.css`](style.css) uses the host's theme variables, wraps long IDs, keeps panel markers compact and fits icon buttons into the control iframe.

See [UI slots](../../docs/en/ui-slots.md) for placement and mounting, and [runtime isolation](../../docs/en/runtime-and-build.md#isolation) for the execution boundaries. This example needs no marketplace entry and does not change the host or its permissions.
