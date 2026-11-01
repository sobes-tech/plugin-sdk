# Start a React plugin

Use these files as a small working baseline, then implement the requested feature. Keep an existing project's structure and package versions when extending it.

## Project setup

Install with Bun in the new plugin directory:

```sh
bun add git+https://github.com/sobes-tech/plugin-sdk.git react@19.1.0 react-dom@19.1.0
bun add -d typescript@~5.8.3 @types/bun @types/react@^19 @types/react-dom@^19
```

Keep the generated `bun.lock`. It pins the resolved SDK revision. Add `"type": "module"` and these scripts to `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "bun build.ts"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["bun"]
  },
  "include": ["src", "manifest.ts", "build.ts"]
}
```

## Manifest and registration

`manifest.ts`:

```ts
import type { PluginManifest } from "@sobes-tech/plugin-sdk";

export const manifest = {
  id: "example.scratchpad",
  version: "1.0.0",
  apiVersion: 1,
  name: { en: "Scratchpad", ru: "Черновик" },
  description: {
    en: "A small writing space inside Sobes.",
    ru: "Небольшое поле для записей в Sobes.",
  },
  permissions: ["ui.render"],
  commands: [],
  views: [{
    id: "main",
    title: { en: "Scratchpad", ru: "Черновик" },
    slot: "app.page",
    renderer: "react",
    icon: "notebook",
  }],
} satisfies PluginManifest;
```

`src/ui.tsx`:

```tsx
import { useState } from "react";
import { renderPlugin, usePlugin } from "@sobes-tech/plugin-sdk/react";
import { Page, Text, Textarea } from "@sobes-tech/plugin-sdk/components";

function Scratchpad() {
  const { locale } = usePlugin();
  const [text, setText] = useState("");
  const label = locale === "ru" ? "Ваши записи" : "Your notes";

  return <Page>
    <Text>{label}</Text>
    <Textarea aria-label={label} value={text} onChange={event => setText(event.target.value)} />
  </Page>;
}

renderPlugin({ main: Scratchpad });
```

This baseline keeps text only while the view is mounted. Add explicit loading and saving through `plugin.files` when persistence is part of the requested feature; do not imply this component saves anything.

`build.ts`:

```ts
import { buildPlugin } from "@sobes-tech/plugin-sdk/build";
import { manifest } from "./manifest";

await buildPlugin({
  manifest,
  uiEntrypoint: "./src/ui.tsx",
  outfile: "./plugin.json",
});
```

Run `bun run typecheck` and `bun run build`. Install `plugin.json` through **Plugins → Installed → Install from file** when desktop validation is authorized and available.

## Convert to a meeting workspace panel

Change the permission to `overlay.render` and the slot to `overlay.workspace`. Keep `renderer: "react"` and the same registration ID. Validate `usePlugin().context.meetingId` before any meeting-bound operation.

For panel sizing, use a transparent root and a bounded content scroller:

```css
.panel { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.content { flex: 1; min-height: 0; overflow: auto; }
```

Do not request `ui.render` for an overlay-only plugin or `overlay.read` merely to receive its context. Data access and changing the composer require their own permissions or grants.

## Convert to an inline overlay button

For a compact action or toggle, keep `renderer: "react"`, use `overlay.render` and replace the view declaration with:

```ts
{
  id: "main",
  title: { en: "Mark meeting", ru: "Отметить встречу" },
  slot: "overlay.toolbar",
  renderer: "react",
  display: "inline",
  inlineWidth: 36,
}
```

Only `overlay.toolbar`, `overlay.panel`, `overlay.footer`, `overlay.message.header` and `overlay.message.footer` accept `display`. Leaving it out, or setting `"popover"`, keeps the popup behavior. `overlay.workspace` and non-overlay slots reject the field. `inlineWidth` is allowed only with `display: "inline"`, must be an integer from 24 to 240 CSS pixels, and defaults to 36 px for toolbar/composer controls or 24 px for message controls.

Replace the page component with an icon-only React control, retaining `renderPlugin({ main: ... })`:

```tsx
function MarkControl() {
  const { locale } = usePlugin();
  const [marked, setMarked] = useState(false);
  const label = locale === "ru"
    ? (marked ? "Снять отметку" : "Отметить встречу")
    : (marked ? "Unmark meeting" : "Mark meeting");

  return <div className="inline-control">
    <Button variant={marked ? "secondary" : "ghost"} size="icon"
      title={label} aria-label={label} aria-pressed={marked}
      onClick={() => setMarked(value => !value)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m5 12 4 4L19 6" />
      </svg>
    </Button>
  </div>;
}

renderPlugin({ main: MarkControl });
```

Import `Button` from `@sobes-tech/plugin-sdk/components` instead of `Page`, `Text` and `Textarea`, and import the control stylesheet from the UI entry point:

```css
.inline-control { width: 100%; height: 100%; min-width: 0; min-height: 0; background: transparent; }
.inline-control > button { width: 100%; height: 100%; min-height: 0; padding: 0; }
```

The host supplies `layout: "control"` and a fixed height of 32 px in the toolbar/composer or 24 px beside messages. `html`, `body` and `#root` fill this height and clip overflow. Keep the root transparent and fit the button within it; menus and portals are clipped, so use `display: "popover"` for those. Workspace `layout: "inline"` is a different layout.

This toggle changes only local React state. For an ordinary action, use `Button onClick` without `aria-pressed`; use the plugin's own state or authorized API. Do not use worker `{action, value}` messages or request `overlay.read`/`overlay.control` merely to implement a local button.
