# React API

[Documentation](README.md) | [Русский](../ru/react-ui.md)

Import hooks from `@sobes-tech/plugin-sdk/react` and UI components from `@sobes-tech/plugin-sdk/components`. React views run in a sandboxed iframe. Declare `renderer: "react"`, a supported slot and its rendering permission in `manifest.views`; pass the React entry point as `uiEntrypoint` to `buildPlugin`.

## Register a view

`renderPlugin` maps manifest view IDs to React components. The map key must equal `views[].id`. Call it once in the UI entry point:

```tsx
import { renderPlugin, usePlugin } from "@sobes-tech/plugin-sdk/react";

function Main() {
  const { locale } = usePlugin();
  return <output>{locale}</output>;
}

renderPlugin({ main: Main });
```

The host selects the component using `environment.viewId`. Missing registration throws `Unknown plugin view`. `renderPlugin` requires the host bridge and returns an unmount function.

| Function from `@sobes-tech/plugin-sdk/react` | Use |
| --- | --- |
| `renderPlugin(views: Record<string, ComponentType>): () => void` | Call once in the UI entrypoint. Mounts the host-selected component and returns an unmount function. |
| `usePlugin(): ReactPluginContext` | Gives a component the core client and current environment. Requires a component tree created by `renderPlugin`. |
| `useWorkspaceHeaderTabs(options: WorkspaceHeaderTabsOptions): boolean` | Publishes tabs in the meeting panel header and reports whether the container supports them. |
| `usePluginApi(): PluginApi` | Returns the [platform API](platform/README.md) client. Check host support before calling those operations. |

## Environment

`ReactPluginContext` combines the core API client and `PluginEnvironment`. The host updates the environment on locale, theme and context changes; `usePlugin()` returns the updated values on rerender.

| Field | Meaning |
| --- | --- |
| `viewId` | The open view's manifest ID |
| `locale` | `"en" \| "ru"` |
| `theme` | `"dark" \| "light"` |
| `settings` | Saved manifest settings, as `Record<string, string \| boolean>`. Mutating this object does not save a setting. |
| `context` | JSON identifying the containing surface; see [view context](ui-slots.md#view-context) |
| `layout` | Optional `"page" \| "inline" \| "control"`, for a full page, an embedded view or a compact inline overlay control |
| `workspace` | Optional `{headerTabs: true}` when the host can place this panel's tabs in its own header |

`context` is a `JsonObject`. Validate fields before use; its shape depends on the [slot](ui-slots.md#view-context). Resource IDs do not grant access to the corresponding resource.

React does not receive worker `input`, `state` or `meeting.getSelected()`. Its `files` object is `PluginFiles`, without the worker-only `files.exportText()` helper. The other core methods use the same permission checks as worker calls.

## Layout and theme

The iframe viewport is the allocated view area. `Page` has a maximum content width of 860 px; `width="full"` removes that limit. `Grid` uses one column at viewport widths up to 640 px.

The host defines `--sobes-content-padding` as 20 px for `layout: "page"`, 16 px at widths up to 640 px, and 0 px for `layout: "inline"` or `layout: "control"`. Inline containers supply their own outer spacing. The variable can be overridden in plugin CSS.

The iframe root is transparent. Host colors are available through CSS variables including `--foreground`, `--background`, `--primary`, `--muted-foreground`, `--card`, `--border`, `--input` and `--ring`. Values update with the host theme. Use CSS fallbacks for variables not supplied by every surface, for example `var(--popover, var(--card))`.

An `overlay.workspace` view fills its allocated height. A scrollable child in a flex layout requires `min-height: 0`:

```css
.panel { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.panel-header { flex: none; }
.panel-content { flex: 1; min-height: 0; overflow: auto; }
```

The iframe URL is not an application route. Use React state or a memory router for local navigation and `app.openPage` for navigation to another declared plugin page.

## Inline overlay controls

The five compact overlay slots support `display: "inline"`: `overlay.toolbar`, `overlay.panel`, `overlay.footer`, `overlay.message.header` and `overlay.message.footer`. The React view becomes the control itself in the native row, without a popup or a separate trigger. For example, declare this view with `permissions: ["overlay.render"]`:

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

The host supplies `layout: "control"` and fixes the height to 32 px in the toolbar or composer, or 24 px for a message control. `inlineWidth` is an integer from 24 to 240 CSS pixels; omit it for a default width of 36 px or 24 px respectively. `display` is not accepted on `overlay.workspace` or non-overlay slots, and `inlineWidth` requires `display: "inline"`. Omitting `display` on a compact overlay slot preserves its popup behavior.

Use an icon-only SDK `Button` with an accessible label and title. Toggle state belongs to the plugin; a normal action uses the same React `onClick` pattern without `aria-pressed`:

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

The host gives `html`, `body` and `#root` the full control height and hides overflow. Keep the root transparent and fit its content to the available width and height. Portals remain inside the iframe and are clipped; use `display: "popover"` for menus or larger content. `layout: "inline"` on a workspace is a different layout and does not make it a compact control.

This example changes only React state, which lasts while the iframe is mounted. Use the plugin's own storage or authorized APIs for persistent behavior. Inline mode does not use worker `{action, value}` messages and does not require `overlay.read` or `overlay.control` merely to toggle local state. Any API call still needs its actual permission or resource grant.

## State after closing a view

React state survives rerenders and remains available while the iframe is mounted. Hiding an opened popup or switching between visited workspace panels preserves their iframes. Navigation, settings changes, package updates, disabling, account/session changes and meeting changes can recreate them. See [state and lifetime](ui-slots.md#state-and-lifetime).

React state is not persistent storage. Use `storage` or `files` for data that must survive a new mount, and validate stored values when reading them. Async cleanup should stop state updates after unmount; it does not cancel a host operation already in progress.

## Workspace header tabs

`useWorkspaceHeaderTabs(options): boolean` publishes tabs in the host header of an `overlay.workspace` view. It returns `true` when that container provides header controls and `false` otherwise.

| Option | Type and constraints |
| --- | --- |
| `items` | `readonly {id: string, label: string}[]`. Up to eight items. IDs must be unique, nonempty and at most 64 UTF-16 code units. Labels must be nonempty and at most 80 units. ASCII control characters are forbidden. |
| `value` | A `string` matching one of the item IDs |
| `onValueChange` | `(id: string) => void`, updates the selected section |

`WorkspaceHeaderTab` is `{ id: string; label: string }`. `WorkspaceHeaderTabsConfig` contains `items` and `value`; `WorkspaceHeaderTabsOptions` also requires `onValueChange`. Labels are plain text in the active locale, not localized objects or JSX. The selected value remains controlled by the plugin.

```tsx
import { useState } from "react";
import { useWorkspaceHeaderTabs } from "@sobes-tech/plugin-sdk/react";
import { Tabs } from "@sobes-tech/plugin-sdk/components";

export function TabbedView() {
  const [value, setValue] = useState("first");
  const items = [{ id: "first", label: "First" }, { id: "second", label: "Second" }];
  const inHeader = useWorkspaceHeaderTabs({ items, value, onValueChange: setValue });
  return <>
    {!inHeader && <Tabs items={items.map(item => ({ value: item.id, label: item.label }))}
      value={value} onValueChange={setValue} />}
    <output>{value}</output>
  </>;
}
```

Header controls support ArrowLeft, ArrowRight, Home and End. Label and selection updates do not remount the component. The host retains its close button. Unmounting clears the tabs; `items: []` with `value: ""` also clears them. No permission beyond the view's rendering permission is required.

## Component reference

The component package includes its stylesheet. Unless specified otherwise, components accept `children`, `className`, `style`, ARIA attributes and standard attributes for their underlying DOM element. `Progress`, `EmptyState` and `Tabs` accept only the listed props. `Input`, `Textarea`, `Checkbox`, `Select` and `Button` forward refs. Exported prop types include `ButtonProps`, `SelectProps`, `SelectOption`, `TabItem`, `Tone` and `MarkdownRendererProps`.

Components from `@sobes-tech/plugin-sdk/ui` instead produce [serialized blocks](ui-slots.md#serialized-ui). They are not React components.

### Layout and text

| Component | Element | Custom props and defaults |
| --- | --- | --- |
| `Page` | `div` | `width?: "content" \| "full" = "content"` |
| `Stack` | `div` | `gap?: number = 16` |
| `Row` | `div` | `gap?: number = 8`, `wrap?: boolean = true` |
| `Grid` | `div` | `columns?: number = 2`, clamped to 1..6; `gap?: number = 16` |
| `PageHeader` | `header` | Required `title: ReactNode`; `description?: ReactNode`, `actions?: ReactNode` |
| `Card` | `section` | Standard section attributes |
| `CardHeader`, `CardContent` | `div` | Standard div attributes |
| `Heading` | `h1`..`h4` | `level?: 1 \| 2 \| 3 \| 4 = 2` |
| `Text` | `p` | `muted?: boolean = false`, `small?: boolean = false` |
| `Separator` | `hr` | Standard hr attributes |

`gap` is measured in CSS pixels. `Grid.columns` is clamped to 1..6. `Table` wraps a standard table in a horizontally scrollable container; it accepts table attributes and expects `thead`, `tbody`, `tr`, `th` and `td` as children.

### Actions and status

| Component | Element | Custom props and defaults |
| --- | --- | --- |
| `Button` | `button` | `variant?: "primary" \| "secondary" \| "outline" \| "ghost" \| "danger" = "primary"`; `size?: "sm" \| "md" \| "lg" \| "icon" = "md"`; `busy?: boolean`; `type` defaults to `"button"` |
| `Pill` | `span` | `tone?: Tone = "neutral"`; `onRemove?: () => void`, `removeLabel?: string = "Remove"` |
| `Badge` | `span` | `tone?: Tone = "neutral"` |
| `TogglePill` | `button` | Required `selected: boolean`; standard button attributes; `type` defaults to `"button"` |
| `Switch` | `button` | Required `checked: boolean`, `onCheckedChange: (checked: boolean) => void`; button attributes except `type` and `role` |
| `Spinner` | `span` | `label?: string = "Loading"`; standard span attributes |
| `Progress` | `progress` | Required `value: number`, `label: string`; `max?: number = 100` |
| `EmptyState` | `div` | Required `title: ReactNode`; `description?: ReactNode`, `icon?: ReactNode`, `actions?: ReactNode`, `className?: string` |

`Tone` is `"neutral" | "success" | "warning" | "danger" | "info" | "accent"`.

`Button.busy` disables the button and displays a spinner. `Pill.onRemove` adds a remove button. `TogglePill` sets `aria-pressed`; `Switch` sets `role="switch"` and `aria-checked`. A Switch `onClick` handler can prevent the change with `event.preventDefault()`.

An empty `Spinner.label` makes the spinner hidden from assistive technology. `Progress` clamps `value` to 0..max, substitutes 100 for invalid `max` and 0 for a nonfinite `value`.

### Fields

| Component | Element and ref | Custom props |
| --- | --- | --- |
| `Input` | `input`, `HTMLInputElement` | Standard input attributes |
| `Textarea` | `textarea`, `HTMLTextAreaElement` | Standard textarea attributes |
| `Checkbox` | Checkbox input, `HTMLInputElement` | Input attributes except `type` |
| `Field` | `div` | Required `label: ReactNode` and one React element child; `description?: ReactNode`, `error?: ReactNode`, `controlId?: string`; div attributes except `children` |
| `Select` | Button trigger, `HTMLButtonElement` | See below |

`Field` uses `controlId`, the child's `id` or a generated ID, in that order. It preserves `aria-describedby` and appends its hint ID. `error` replaces `description`, sets `aria-invalid` on the child and gives the message `role="alert"`. Validation is performed by the caller.

`Input` and `Select` have a minimum height of 36 px. `Textarea` has a minimum height of 100 px and supports vertical resizing.

### Select

`Select` provides single selection through a React popup inside the iframe, without an OS-native menu. It forwards a `HTMLButtonElement` ref to its trigger.

| Prop | Type and default |
| --- | --- |
| `options` | Required `readonly SelectOption[]` |
| `value` | String selection controlled by the parent component |
| `defaultValue` | Initial selection when Select owns its state; default `""` |
| `onValueChange` | Optional `(value: string) => void` |
| `placeholder` | Optional `ReactNode`; default `"Select…"` |
| `name`, `form` | Optional strings for form submission and association |
| `required`, `disabled` | Optional booleans |
| `dir` | Optional `"ltr" \| "rtl"` |
| `onOpenChange` | Optional `(open: boolean) => void` |

`SelectOption` is `{ value: string; label: ReactNode; disabled?: boolean; textValue?: string }`. Values must be unique, nonempty strings. The empty string means no selection. `textValue` supplies typeahead text for labels that contain more than plain text.

`onValueChange` receives the selected string. Standard button attributes apply to the trigger. `children`, `onChange`, `multiple`, `size` and `type` are not supported. No options disables the control. For an uncontrolled Select, form reset restores its initial `defaultValue`. An empty required selection blocks submission.

Keyboard controls: arrows, Home, End, typeahead, Enter, Space and Escape. Disabled options are skipped. The popup is portaled into the iframe body, selects the available side and scrolls within the viewport. It cannot extend outside the iframe. Inline views can reserve popup space up to the host's panel-height limit.

### Tabs and tables

`Tabs` requires `items: TabItem[]`, `value: string` and `onValueChange: (value: string) => void`. Optional props: `label?: string = "Tabs"` and `className?: string`.

`TabItem` is `{ value: string; label: ReactNode; icon?: ReactNode; disabled?: boolean; content?: ReactNode }`. Items with `content` render a panel; inactive panels remain mounted with `hidden`. An invalid selection displays the first enabled item. Keyboard controls are ArrowLeft, ArrowRight, Home and End.

`Table` accepts standard table attributes, `children` and `className`; its wrapper provides horizontal scrolling.

## Markdown

`MarkdownRenderer` is exported from `@sobes-tech/plugin-sdk/components` and `@sobes-tech/plugin-sdk/markdown`. `MarkdownRendererExtended` is the same component.

| Prop | Type and default |
| --- | --- |
| `content` | Required `string \| string[] \| null \| undefined`; arrays are joined without a separator |
| `answerHighlights` | `boolean = true` |
| `isStreaming` | `boolean = false` |
| `allowSafeHtml` | `boolean = false` |
| `className`, `style` | CSS class and React CSS properties |
| `componentOverrides` | `Partial<Components>` from `react-markdown` |
| `onOpenLink` | Optional `(url: string) => void` |

Supported content: GFM tables and task lists, code highlighting, inline/block LaTeX, `<br>` and `[[m:...]]`, `[[t:...]]`, `[[e:...]]`, `[[c:...]]` highlights. Code regions retain highlight markers literally. `isStreaming` hides an incomplete trailing marker; it does not start generation. KaTeX fonts and highlighting assets are bundled.

Link navigation is prevented by default. `onOpenLink` receives the URL; opening it through `app.openExternal` requires that permission:

```tsx
import { usePlugin } from "@sobes-tech/plugin-sdk/react";
import { MarkdownRenderer } from "@sobes-tech/plugin-sdk/components";

export function Content({ value, onError }: { value: string; onError: (error: unknown) => void }) {
  const { app } = usePlugin();
  return <MarkdownRenderer content={value}
    onOpenLink={url => { void app.openExternal(url).catch(onError); }} />;
}
```

Default image rendering accepts PNG, JPEG, GIF and WebP base64 data URLs and blob URLs. Other sources render alt text. `allowSafeHtml` enables sanitized HTML with scripts, event handlers, iframes and styles removed. `componentOverrides` replaces renderers without changing the iframe's access rules.

### Markdown helpers

Import from `@sobes-tech/plugin-sdk/markdown-core`. Remark/rehype factories return transforms that mutate the supplied tree; string functions return a new string.

| Export | Behavior |
| --- | --- |
| `remarkAnswerHighlights()` | Handles `[[m:...]]`, `[[t:...]]`, `[[e:...]]` and `[[c:...]]` in a remark tree. Creates `answerHighlight` nodes rendered as `mark` with `data-hl`. A marker stays within one parent node and can remain open until its end. Unmatched closing markers remain text. Skips code, inline code, math, inline math and HTML nodes. |
| `trimPartialAnswerHighlight(content: string): string` | Removes `[[`, `[[m`, `[[t`, `[[e` or `[[c` at the end of a string. Used for incrementally received text. It does not parse Markdown or recognize code regions. |
| `rehypeRawLineBreaks()` | Converts raw HTML containing `<br>` and text into `br` and text nodes. It replaces a parent's raw children only when each contains `<br>` and none contains other HTML tags. Leaves other HTML alone; it is not a sanitizer. |
| `normalizeMathDelimiters(content: string): string` | Converts `\[...\]` to a `$$` block and `\(...\)` to `$...$`, trimming inner edge whitespace. Leaves triple-backtick fences, triple-tilde fences and single-backtick code spans unchanged. |
