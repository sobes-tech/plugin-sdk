# UI slots

[Documentation](README.md) | [Русский](../ru/ui-slots.md)

`PluginViewContribution.slot` selects a host mount point. Each entry in `manifest.views` must have a unique `id`, a localized `title` and a supported `slot`. The same ID is used in `renderPlugin` or `definePlugin({views})`.

The host rejects unknown slots. Plugins cannot declare additional host areas or replace built-in controls and the native titlebar.

## Renderers

| | React | Worker-rendered interface |
| --- | --- | --- |
| Build input | `uiEntrypoint` in `buildPlugin` | `entrypoint` in `buildPlugin` |
| Registration | `renderPlugin({viewId: Component})` | `definePlugin({views: {viewId: handler}})` |
| Manifest field | `renderer: "react"` | Omit `renderer` |
| Output | DOM inside an iframe | JSON elements rendered by Sobes |
| State | React state while the component exists | Returned `state`, passed to the next handler invocation |
| Meeting-overlay slots | Supported | Not supported |

Both renderers use API 1. A package may contain React views alongside worker commands and events. Data permissions are independent of rendering permissions. See [runtime and build](runtime-and-build.md).

A React view declaration:

```ts
import type { PluginViewContribution } from "@sobes-tech/plugin-sdk";

export const view: PluginViewContribution = {
  id: "main",
  title: { en: "Panel", ru: "Панель" },
  slot: "overlay.workspace",
  renderer: "react",
};
```

This declaration requires `overlay.render` and a UI entry point that calls `renderPlugin({ main: Component })`.

## Main-window pages and panels

`app.page` creates `/plugins/:pluginId/:viewId` and occupies the main content area. It has a sidebar entry unless `showInSidebar: false` is set.

`app.openPage(viewId, query)` opens an `app.page` declared by the calling plugin. The host supplies the plugin ID. The method requires `app.navigate`; string query values are available through the destination's `context.search`.

Other main-window slots use panel selectors within their containing surface. A panel mounts on first open. One panel per area is visible; closing it or switching panels preserves mounted content until the containing page is destroyed. Height is limited to `min(35vh, 20rem)`, with overflow scrolling. See [layout and theme](react-ui.md#layout-and-theme).

## Overlay controls

`overlay.toolbar`, `overlay.panel` and `overlay.footer` add a button that opens a popup by default (`display` omitted or `display: "popover"`). The slot determines its initial position. Users can move, reorder or hide these controls in the Meeting Panel editor. Moving a control does not change its renderer.

Popups close on outside interaction or focus loss. Escape and the close button restore focus to the trigger. An inner control can consume Escape with `event.preventDefault()`. Normal popup close preserves the iframe.

Set `display: "inline"` to render the React view directly in the native row, without a popup or a separate host trigger. This mode is supported only by `overlay.toolbar`, `overlay.panel`, `overlay.footer`, `overlay.message.header` and `overlay.message.footer`. Use it for a compact action button or a toggle whose state belongs to the plugin. Handle interaction with a React `onClick` and expose toggle state through `aria-pressed`; the worker action protocol does not apply.

An inline control has the row's fixed control height. `inlineWidth` optionally sets its width to an integer from 24 to 240 CSS pixels; the default is 36 px in the toolbar or composer and 24 px beside a message. Fit the transparent view root to 100% width and height. See [inline overlay controls](react-ui.md#inline-overlay-controls) for a complete React example. `inlineWidth` requires `display: "inline"`; `display` itself is rejected on `overlay.workspace` and all non-overlay slots.

`overlay.workspace` opens a resizable panel beside the meeting content on wide windows and above it on narrow windows. It does not close on outside interaction. One plugin workspace is visible at a time; previously opened workspaces remain mounted for the current meeting.

Workspace content receives `layout: "inline"` and fills the allocated height. The host supplies outer padding. Header controls are available through [useWorkspaceHeaderTabs](react-ui.md#workspace-header-tabs).

## Message controls

`overlay.message.header` and `overlay.message.footer` add controls for an individual message. Visibility is configured separately for answers, requests and transcripts. By default the React view mounts when its popup is opened. With `display: "inline"`, it renders directly in the message's control row.

The context contains `meetingId`, `messageId` and `messageType`. Message text is not included; it requires an authorized API read.

## Slot reference

The first 15 slots require `ui.render`. The six `overlay.*` slots require `overlay.render`, `renderer: "react"` and a UI bundle.

| Slot | Location |
| --- | --- |
| `app.sidebar.top` | Near the top of the main-window sidebar |
| `app.sidebar.bottom` | Near the bottom of the main-window sidebar |
| `app.page` | Dedicated page at `/plugins/:pluginId/:viewId` |
| `meetings.header` | Above the meeting list |
| `meetings.footer` | Below the meeting list |
| `meeting.header` | Top of the meeting preview |
| `meeting.overview` | Meeting overview |
| `meeting.footer` | Bottom of the meeting preview |
| `meeting.history` | Meeting history |
| `meeting.gallery` | Meeting gallery |
| `notes.header` | Above the notes interface |
| `notes.footer` | Below the notes interface |
| `tracker.header` | Above the tracker |
| `tracker.footer` | Below the tracker |
| `plugins.installed` | Installed-plugins section |
| `overlay.toolbar` | Popup button or inline control, initially in the meeting toolbar |
| `overlay.workspace` | Resizable panel, with its button initially in the meeting toolbar |
| `overlay.panel` | Popup button or inline control, initially in the message composer |
| `overlay.footer` | Popup button or inline control, initially in the message composer |
| `overlay.message.header` | Popup button or inline control beside a message header |
| `overlay.message.footer` | Popup button or inline control beside a message footer |

Available slots are also listed by `api.capabilities`. See the [manifest reference](manifest-and-permissions.md) for `order`, icons and the remaining view fields.

## View context

React reads context through `usePlugin().context`; workers receive `ctx.context`.

| Surface | Context fields |
| --- | --- |
| Main window | `path`, `search`; meeting areas also receive `meetingId` |
| Meeting-window button or workspace | The bound `meetingId` |
| Message button | `meetingId`, `messageId`, `messageType`: `"answer"`, `"request"` or `"transcript"` |

Context values are JSON and must be checked before use. Query parameters passed through `app.openPage` are encoded in `context.search`:

```ts
import type { JsonObject } from "@sobes-tech/plugin-sdk";

export function queryValue(context: JsonObject, key: string): string | null {
  const search = typeof context.search === "string" ? context.search : "";
  return new URLSearchParams(search).get(key);
}
```

Main-window route fields are not guaranteed in overlay views. Reading overlay metadata and the message-input value requires `overlay.read`; changing that value requires `overlay.control`. These operations do not send a message, start recording or start generation.

An inline button that changes only plugin state needs neither `overlay.read` nor `overlay.control`. Its placement does not authorize reading a message or operating built-in controls; request only the permissions and grants used by its actual API calls.

## State and lifetime

| Action | Effect on React state |
| --- | --- |
| Rerender, language or theme change | Preserved |
| Closing a main-window panel | Preserved while its containing page exists |
| Closing a meeting popup | Preserved while its control remains mounted |
| Closing or switching an `overlay.workspace` panel | Visited workspace state remains within that meeting |
| Leaving the page containing the interface | The iframe can be destroyed |
| Changing settings, updating, disabling or removing the plugin | Current work stops; the interface can be recreated |
| Switching account, app session or bound meeting | The old interface loses API access; the new context gets a new interface |
| Hiding an `overlay.workspace` control in settings | Its panel closes and is removed |

React state lasts while its iframe is mounted. Use [storage or JSON files](api.md) for data that must survive a new mount, and validate loaded values. Worker state is passed explicitly between invocations; see [runtime and build](runtime-and-build.md).

## Serialized UI

A worker view returns `PluginView` with `title`, `blocks` and optional `state`, a single `PluginBlock`, or no result. For an action, the host runs the view handler again with an action object in `ctx.input` and the previous result's state in `ctx.state`.

The worker has no persistent React component or DOM. Declare the view in a main-window slot with `ui.render` and omit `renderer`. Use `jsxImportSource: "@sobes-tech/plugin-sdk"` and the `/ui` components:

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

React JSX and serialized JSX are different representations. Serialized event attributes contain action names, not callbacks.

### Elements and actions

| Component | Fields used by the host |
| --- | --- |
| `Stack`, `Row` | Children; `style` |
| `Grid` | Children; `columns` clamped to 1..6; `style` |
| `Card` | `title`, children; `style` |
| `Text`, `Heading` | `text`, children; `style` |
| `Button` | `label` or children, `action`, `value`, `payload`, `disabled`, `style`; `variant: "outline"` or `"ghost"`, otherwise the default button |
| `Input` | `label`, `name`, `value`, `action`, `placeholder`, `disabled`; `inputType: "number"` or text |
| `TextArea` | `label`, `name`, `value`, `action`, `placeholder`, `disabled` |
| `Select` | Field properties plus `options: {value, label}[]` or primitive options |
| `Checkbox` | `label`, `name`, boolean `value`, `action`, `disabled` |
| `Table` | `columns`, `rows`, `style`; `action` and `payload` for a first-cell row action |
| `Image` | `src`, `alt`, `style` |
| `Link` | `label` or children, `href`, `action`, `payload`, `style` |
| `Markdown`, `Code` | `text`, `style` |
| `Badge` | `label` or children, `style` |
| `Divider`, `Spacer` | `style` |
| `Progress` | `value` clamped to 0..100, `label`, `style` |
| `Tabs` | `options` with `value`, `label` and optional `icon`; selected `value`, `action`, `payload`, children, `style` |

Buttons and tabs produce `{action, value}` merged with `payload`. The default action is `"click"`. Links pass `href` as `value` and do not navigate directly. Table actions pass the whole row as `value`.

Fields produce `{action, name, value}` with default action `"change"`. Checkbox and Select emit immediately; text fields emit on blur, and Input also emits on Enter. A numeric Input still emits a string.

Renderer limits: 200 Select options, 30 table columns, 200 table rows, 10,000 Input characters and 100,000 TextArea characters. Heading produces `h3`. Serialized Markdown has no active links or remote images. Use the React [MarkdownRenderer](react-ui.md#markdown) for math, syntax highlighting or custom renderers.

### Allowed styles

`style` is a JSON object. Unsupported properties are ignored.

| Properties | Values |
| --- | --- |
| `width`, `maxWidth`, `minWidth`, `height`, `maxHeight`, `minHeight`, `padding`, `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight`, `gap`, `borderRadius`, `fontSize`, `fontWeight`, `opacity` | Finite numbers from 0 to 2,000 |
| `color`, `backgroundColor`, `borderColor` | Hex colors or `var(--foreground)`, `var(--background)`, `var(--primary)`, `var(--muted)`, `var(--muted-foreground)`, `var(--card)`, `var(--border)`, `var(--destructive)` |
| `textAlign` | `"left"`, `"center"` or `"right"` |

Images accept PNG, JPEG, WebP, GIF and BMP base64 data URLs shorter than 12 MiB. The complete output remains subject to [runtime limits](runtime-and-build.md).

### JSX runtime

Import path: `@sobes-tech/plugin-sdk/jsx-runtime`. `@sobes-tech/plugin-sdk/jsx-dev-runtime` exports the same functions.

| Export | Result |
| --- | --- |
| `jsx(type: PluginElementTag \| Component, values: ElementProps \| null): PluginBlock` | For a tag, creates `{type: "element", tag, props, children}` with empty props for `null`. For a component function, calls it with the supplied props. |
| `jsxs`, `jsxDEV` | Aliases of `jsx`, with the same checks |
| `Fragment` | A `stack` element, so `<>...</>` adds a vertical container in this JSX implementation |

Child arrays are flattened recursively. Strings and numbers become text blocks. Booleans, `null` and `undefined` are omitted; existing `PluginBlock` values are retained. Function-valued tag attributes throw an error. A function is accepted as the component `type` because it runs before serialization.

`Child` describes supported child values. `ElementProps` maps property names to JSON, child values or `undefined`. `Component` returns `PluginBlock`; `JSX.Element` is also `PluginBlock`. Intrinsic tags are limited to `PluginElementTag`.
