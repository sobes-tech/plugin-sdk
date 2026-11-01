# Publishing

[Documentation](README.md) | [Русский](../ru/publishing.md)

Host the package in the author's GitHub repository or a GitHub Release. Publish metadata separately in [plugin-marketplace](https://github.com/sobes-tech/plugin-marketplace). The catalog references a built JSON package and its SHA-256; it does not build source code.

## Package source

`source` accepts two shapes:

| Type | Fields |
| --- | --- |
| `github` | `{ type: "github", repository, revision, path }` |
| `release` | `{ type: "release", repository, tag, asset }` |

`repository` uses `owner/repository`, up to 201 characters. `revision` is a full 40-character lowercase hexadecimal commit SHA. `path` is repository-relative, up to 300 characters, with no empty, `.` or `..` segments. Each segment permits ASCII letters, digits, `_`, `-` and `.`.

A `release` source specifies a tag of up to 128 characters and an asset filename of up to 200 characters. Asset names allow ASCII letters, digits, `_`, `-` and `.`. Replacing the asset without updating SHA-256 causes verification to fail.

## Checksum

SHA-256 covers the exact output JSON bytes. Code, formatting and final-newline changes alter the checksum. The catalog `manifest` must match the manifest inside the package.

```sh
bun - ./plugin.json <<'TS'
import { createHash } from "node:crypto";

const bytes = await Bun.file(Bun.argv[2]).bytes();
console.log(JSON.stringify({
  manifest: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).manifest,
  sha256: createHash("sha256").update(bytes).digest("hex"),
}, null, 2));
TS
```

## Catalog entry

File: `entries/<plugin-id>.json`.

| Field | Required | Constraint |
| --- | --- | --- |
| `id` | Yes | Manifest ID, up to 100 characters |
| `publisher` | Yes | Nonempty string, up to 200 characters |
| `category` | Yes | Category from `marketplace.base.json`, up to 100 characters |
| `keywords` | Yes | String array, up to 20 entries |
| `updatedAt` | Yes | Nonempty date string, up to 30 characters |
| `manifest` | Yes | Complete package manifest; `apiVersion: 1` and semantic `version` |
| `source` | Yes | One of the source shapes above |
| `sha256` | Yes | 64 lowercase hexadecimal characters |
| `changelog` | Yes | `{ en: string, ru: string }`; nonempty strings of up to 1,000 characters |
| `overview` | No | Markdown `{ en: string, ru: string }`; 20,000 UTF-8 bytes per language, no HTML |
| `repository` | No | HTTPS repository URL on `github.com`, up to 2,048 characters |
| `screenshots` | No | Up to 10 `{ url, caption? }` objects; `caption` contains nonempty `en` and `ru` of up to 500 characters |

Screenshot HTTPS hosts: `github.com`, `raw.githubusercontent.com` and `user-images.githubusercontent.com`. URLs containing credentials or an explicit port are rejected.

Schema: [marketplace.schema.json](https://github.com/sobes-tech/plugin-marketplace/blob/main/schema/marketplace.schema.json). Additional validation: [validate.ts](https://github.com/sobes-tech/plugin-marketplace/blob/main/scripts/validate.ts).

## Catalog build

Run in the marketplace repository:

```sh
bun install --frozen-lockfile
bun run build
bun run check
bun run test
bun run check:remote
```

`build` generates `marketplace.json` from `entries/` and `marketplace.base.json`. `check` verifies that generated output matches those inputs. `check:remote` downloads packages and validates SHA-256 and manifests. Package sources must already be reachable.

A pull request includes `entries/<plugin-id>.json` and the generated `marketplace.json`.

## Updates

Keep the plugin ID. Set the release in `manifest.version`. An available update requires a SemVer greater than the installed version; build-metadata-only changes do not count.

Update the package, `source`, `sha256`, `manifest`, `updatedAt` and `changelog`. Catalog refresh retrieves metadata but does not install packages. Installation and permission changes require user confirmation.
