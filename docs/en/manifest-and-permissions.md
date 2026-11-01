# Manifest and permissions

[Documentation](README.md) | [Русский](../ru/manifest-and-permissions.md)

`PluginManifest` declares plugin identity, UI contributions, commands, events, settings and requested permissions. It is stored in `PluginPackage.manifest` and validated by the host before installation. Unknown fields and unsupported API versions are rejected.

## Fields

| Field | Required | Accepted value |
| --- | --- | --- |
| `id` | Yes | Stable plugin ID. Follow the ID rules below. |
| `version` | Yes | A semantic version, such as `1.0.0`. Increment it when distributing an update. |
| `apiVersion` | Yes | The number `1`. |
| `name`, `description` | Yes | Localized text: `{ en: string, ru: string }`. Each string must be nonblank and at most 1,000 UTF-8 bytes. |
| `permissions` | Yes | An array of permission IDs from the table below. Duplicates and unknown IDs are rejected. |
| `commands` | Yes | Up to 64 command declarations. Use `[]` for a plugin without worker commands. |
| `views` | No | Up to 64 view declarations. |
| `events` | No | An array of supported lifecycle event names. Requires `events.subscribe`. See [runtime and build](runtime-and-build.md). |
| `settings` | No | Up to 64 settings declarations. |
| `networkDomains` | No | Up to 32 lowercase hostnames or wildcard entries, each at most 253 bytes. Supports `*` and `*.example.com`; no scheme, port or path. See [network access](network.md#declare-access). |
| `requiredFeatures` | No | Feature IDs required by the plugin. A host missing one rejects installation. See the [platform API](platform/README.md). |
| `grants` | No | Requested resource operations, scopes and fields. The user approves effective grants during installation. |

Declare at least one command, view or event. Unknown fields and unsupported API versions fail package validation.

### IDs and labels

`id` identifies the plugin's installation, updates and stored data. Changing it creates a separate plugin. `name` is independent display text.

Plugin, command, view and setting IDs are 1–100 ASCII characters: lowercase letters, digits, `-` and `.`. The first character must be a letter or digit. Consecutive dots and a trailing dot are forbidden. Command, view and setting IDs must be unique within their corresponding lists.

`LocalizedText` is `{ en: string; ru: string }`. Both values are required, nonblank and limited to 1,000 UTF-8 bytes each. The host selects the corresponding supplied value; it does not translate it.

`localized(text: LocalizedText, locale: string): string` selects `text.ru` when the case-insensitive locale starts with `ru`, including `ru-RU`. All other values select `text.en`. This helper performs no validation.

### Commands

Shape: `{ id: string; title: LocalizedText; location: "meeting" | "settings" }`.

`id` must match a key in `definePlugin({ commands: ... })`. A `meeting` command can receive a selected-meeting snapshot; reading it through `ctx.meeting.getSelected()` requires `meeting.read` or `meetings.read`. A `settings` command has no selected-meeting snapshot. Account data remains accessible through methods such as `meetings.get` with their own permissions.

### Views

Shape: `{ id, title, slot, order?, renderer?, icon?, showInSidebar?, display?, inlineWidth? }`. The `slot` must be one of the declared [UI slots](ui-slots.md). Unknown slots are rejected.

`renderer: "react"` requires a UI bundle built from `uiEntrypoint`. When `renderer` is absent, the view is returned by a `definePlugin({ views: ... })` worker handler. Overlay slots require React. The declared `id` must match the registered component or handler key.

`display?: "popover" | "inline"` is accepted only for `overlay.toolbar`, `overlay.panel`, `overlay.footer`, `overlay.message.header` and `overlay.message.footer`. Omitting it preserves the popup button behavior, as does `display: "popover"`. With `display: "inline"`, the React view itself occupies a control in the native row; there is no popup or separate host trigger. `overlay.workspace` and every non-overlay slot reject `display`, including `"popover"`.

`inlineWidth?: number` is accepted only with `display: "inline"` and must be an integer from 24 to 240, in CSS pixels. If omitted, the host uses 36 px for toolbar and composer controls, or 24 px for message controls. The host fixes the height to the row's control height. These fields do not grant API access; the view still needs `overlay.render`, and its actions need their own permissions or resource grants. See [inline overlay controls](react-ui.md#inline-overlay-controls) for sizing and React handlers.

`order` is a signed 32-bit integer; the default is `0`. Contributions in one slot are sorted in ascending order. `showInSidebar` controls the navigation entry for an `app.page`; `false` hides it. The page remains accessible through `app.openPage`.

`icon` accepts one host icon name, not SVG or an image URL: `layout-dashboard`, `file-text`, `calendar`, `image`, `notebook`, `chart`, `code`, `puzzle`, `settings`, `globe`, `search`, `list`, `folder`, `message`, `sparkles`, `kanban`, `terminal`, `book`, `bolt`, `star`.

### Settings

```ts
import type { LocalizedText } from "@sobes-tech/plugin-sdk";

interface PluginSetting {
  id: string;
  title: LocalizedText;
  default: string | boolean;
  inputType?: "text" | "url" | "password";
}
```

`settings` declares values editable from the installed plugin's settings page. A boolean `default` produces a switch; a string produces a text field. String defaults are limited to 2,000 UTF-8 bytes. Values are supplied through `ctx.settings` and `usePlugin().settings`.

`inputType` applies only to string settings. It selects a normal text field, a URL field or a masked password field. A boolean default with `inputType` is rejected. Password masking is only presentation: settings are stored in local JSON, not an encrypted vault. Do not include real credentials in manifest defaults.

Changing settings revokes active executions and view leases. A React view can be recreated with the new values. Persistent plugin data belongs in [storage or files](api.md#storage), separately from component state.

## Permission reference

Permissions are checked per method. Read and write access are independent. Installation requires confirmation of the exact package's permission list; an update replaces that list with the new manifest permissions.

| Permission | Scope | Allows |
| --- | --- | --- |
| `meeting.read` | Selected meeting | Worker helper `meeting.getSelected()`. |
| `meetings.read` | Current account | `meetings.list`, `meetings.get`, `meetings.messages`; also the supplied worker meeting snapshot. |
| `meetings.write` | Current account | `meetings.create`, `meetings.rename`. |
| `screenshots.read` | Current account | `screenshots.list`, `screenshots.get`. |
| `notes.read` | Current account | `notes.list`, `notes.get`, `notes.folders`. |
| `notes.write` | Current account | `notes.create`, `notes.update`. |
| `tracker.read` | Current account | `tracker.columns`, `tracker.cards`, `tracker.get`. |
| `tracker.write` | Current account | `tracker.create`, `tracker.update`. |
| `models.read` | Application | `models.list`. This does not authorize generation. |
| `clipboard.write` | Device | `clipboard.writeText`. No clipboard read access. |
| `app.navigate` | Application | `app.navigate`, `app.openPage`. |
| `app.openExternal` | Device | `app.openExternal`. |
| `notifications.show` | Application | `notifications.show`. |
| `events.subscribe` | Current account | Declared worker lifecycle handlers. The [resource event stream](platform/events.md) uses resource grants instead. |
| `network.request` | Declared domains | `network.request`, restricted to `networkDomains`. |
| `ui.render` | Declared app slots | Views outside the overlay and UI returned by workers. |
| `overlay.render` | Declared overlay slots | React views in the meeting overlay. |
| `overlay.read` | Active overlay | `overlay.context`. |
| `overlay.control` | Active overlay | `overlay.setDraft`, `overlay.insertText`. |
| `files.export` | User-selected destination | Worker helper `files.exportText`. |
| `files.userSelected` | User-selected JSON file | `files.openJson`, `files.saveJson`. Each call opens a system picker. |
| `plugin.storage` | Plugin installation and account | `storage.get`, `storage.set`, `storage.remove`. Implicit. |
| `plugin.files` | Plugin installation and account | `files.readJson`, `files.writeJson`, `files.list`. Implicit. |
| `api.inspect` | Application | `api.capabilities`. Implicit. |

`plugin.storage`, `plugin.files` and `api.inspect` are implicit and require no entry in `permissions`. They provide private plugin storage and host inspection, not access to account resources or the overlay's message input.

`network.request` also requires `networkDomains`. An exact hostname allows that host only. `*.example.com` allows one or more subdomain labels, such as `api.example.com` and `v2.api.example.com`, but excludes `example.com` itself. `*` allows any public HTTPS destination. Wildcards do not bypass the host's private-IP checks, and each redirect is checked again.

Use lowercase DNS labels of at most 63 characters, separated by dots; labels cannot start or end with `-`. International names use punycode. Schemes, paths, ports, empty labels and partial globs such as `api.*.com` are invalid. The part after `*.` must contain at least two labels, so `*.com` is invalid. An update that changes this list requires the user's approval.

### Permission metadata

The exported `permissions` array contains the following fields for each permission:

| Field | Content |
| --- | --- |
| `id` | Permission identifier. |
| `title` | `LocalizedText` for its displayed name. |
| `scope` | Scope name, such as `account`, `plugin` or `declaredDomains`. |
| `risk` | `read`, `write`, `render` or `network`. |
| `methods` | RPC method names authorized by this permission. Local helpers and UI contributions can have an empty array. |
| `implicit` | Whether the permission is available without requesting it in the manifest. |

This array is metadata. Modifying it in plugin code does not change authorization; the native host uses its own registry.

## Enforcement

The host derives account identity from the authenticated application session. Plugin arguments cannot select another account. Installation, package revision and permission checks run before the call and again before the result is returned.

Disabling, updating or uninstalling a plugin revokes active work. Settings and session changes can also revoke it. Revocation rejects late results but does not roll back a request already sent to a server. See [errors and retries](api.md#errors-and-retries).

Core resource permissions apply to the corresponding data in the signed-in account. The [platform API](platform/README.md) separately checks grants for individual resources, operations and fields.
