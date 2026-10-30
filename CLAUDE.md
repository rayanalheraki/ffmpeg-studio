# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

FFmpeg Studio is a Tauri 2 + React + TypeScript desktop GUI for FFmpeg. The UI runs in the system webview (WebView2 on Windows), built with Vite. FFmpeg/FFprobe binaries come from `ffmpeg-static` / `ffprobe-static` and are bundled as Tauri `externalBin` sidecars.

## Commands

```bash
npm run dev                # Tauri app with UI hot reload (copies FFmpeg sidecars first)
npm run build              # typecheck (both tsconfigs) + vite build of the UI into out/renderer
npm run typecheck          # tsc for tsconfig.node.json (backend/shared/tests, Node + DOM libs) and tsconfig.web.json (renderer/backend/shared)
npm run lint               # ESLint, --max-warnings 0 (warnings fail)
npm run format             # Prettier (printWidth 140, single quotes, trailing commas)
npm test                   # Vitest unit tests (tests/**, excluding tests/integration)
npm run test:integration   # Runs operations through the real FFmpeg from ffmpeg-static on generated media (slow, 120s timeouts)
npm run package            # Installer via the Tauri bundler -> src-tauri/target/release/bundle/
```

Single test file / single test: `npx vitest run tests/operations/edit.test.ts` or `npx vitest run -t "trim"`. For integration: `npx vitest run --config vitest.integration.config.mts -t "<name>"`.

Rust (stable) and the Tauri prerequisites are required (Windows: VS C++ Build Tools). `scripts/prepare-binaries.mjs` copies the FFmpeg binaries to `src-tauri/binaries/<name>-<target-triple>` (gitignored); if they are missing after install: `npm rebuild ffmpeg-static`.

## Architecture

Source roots with a strict boundary:

- `src-tauri/` – Rust: `process.rs` runs the bundled `ffmpeg`/`ffprobe` (the webview names one of the two programs, never a path; args are an array, never a shell), streams output over a `Channel`, kills processes on exit; `files.rs` has path info/mkdir/remove/reveal/open (absolute paths only) and reads/writes `settings.json` in the app config dir. `tauri.conf.json` holds the window, CSP and NSIS config; `capabilities/default.json` the allowed core/plugin permissions.
- `src/backend/` – TypeScript that runs in the webview and implements `StudioApi` (`index.ts`): job queue, job creation, probing, thumbnails, settings store. `host.ts` is the only module that calls Rust commands; `system.ts` wraps Tauri window/dialog/webview APIs. Must not import Node APIs.
- `src/renderer/` – React UI. Talks to the system only via `studio` from `lib/api.ts`. State lives in context providers under `state/` (files, jobs, settings, toasts). Styling is CSS Modules (camelCase class names) + design tokens in `styles/tokens.css`.
- `src/shared/` – pure code imported via the `@shared/*` alias: types, the `StudioApi` contract (`ipc.ts`), operation definitions, job planning/command helpers, `utils/path.ts` (platform-agnostic path helpers; use these instead of `node:path`).

### System API

`src/shared/ipc.ts` defines `StudioApi`. Adding a call means touching: `shared/ipc.ts` (type) → `backend/index.ts` (implementation, wrapped in `guard()`) → if it needs the OS, a Rust command in `src-tauri/src/*.rs` registered in `lib.rs` `generate_handler!` plus a wrapper in `backend/host.ts` (JS camelCase args map to Rust snake_case). Throw `UserError` (from `backend/log.ts`) for messages that should reach the user verbatim; any other error is logged and replaced with a generic message. Inputs are still validated in the backend (`normalizeOptions`, absolute paths).

Files dragged in from the OS arrive as Tauri webview events (with paths and a position), not HTML5 drop events; `hooks/useFileDrop.ts` hit-tests registered zones. HTML5 drag & drop does not work inside the window on Windows, so list reordering (`hooks/useReorder.ts`) uses pointer events. The title bar uses `data-tauri-drag-region`.

### Operations (the core extension point)

Each file in `src/shared/operations/definitions/` default-exports `defineOperation<Options>({...})` and is auto-discovered by `registry.ts` via `import.meta.glob` — no registration step. A definition declares its option fields (the UI form is generated from them), optional `extraSlots` for secondary inputs (`all` vs `paired` distribution), `outputExtension`, `validate`, `expectedDuration`, and a pure `buildArgs(options, inputs, ctx)`.

Rules for `buildArgs`: return FFmpeg args without the binary and without global flags; **the output path (`ctx.output`) must be the last argument** — `assembleArgs` in `shared/jobs/command.ts` relies on this to insert global/progress flags at the front and user extra args just before the output. Reuse helpers in `operations/helpers/` (`encoders.ts`, `streams.ts`, `filters.ts`). See the README's "Adding a new operation" section for a full example; add tests in `tests/operations/` (the registry test already checks every operation's defaults produce well-formed args).

### Batch → jobs flow

The same pure shared functions run in two places, which keeps the UI preview identical to what executes:

1. Renderer preview (`hooks/useBatchPreview.ts`): `planJobs` → `plannedOutputPath` → `buildArgs` → `assembleArgs` → `formatCommand` to show the exact command.
2. Execution (`backend/queue/create-jobs.ts`): the UI passes only operation id, options, file paths, output settings and extra-args text — **never a command**. The backend re-probes files, runs `normalizeOptions` (coerces/clamps untrusted values against the field schema), `planJobs`, `validate`, resolves output collisions (`output-path.ts`, overwrite/rename/skip, tracking reserved paths), and rebuilds args.

`JobQueue` (`backend/queue/job-queue.ts`) runs up to N concurrent FFmpeg processes through `process_spawn`, parses `-progress pipe:1` against the expected duration, keeps stderr as the job log, emits `JobEvent`s to the renderer (throttled), deletes partial outputs on failure (except image sequences), and fires a desktop notification when a batch ends.

### Translations (English, Arabic, Turkish)

`src/shared/i18n/` is gettext-style: the English text is the key, and `locales/{ar,tr}/` map it to translations (`operations.ts` for definition strings, `app.ts` for everything else). Missing keys fall back to English. There is one locale (`setLocale`) shared by renderer and backend, driven by `settings.language`; the backend translates its own messages (errors, notifications, dialogs, job messages).

- Renderer components use `const { t, tp } = useI18n()` (from `state/i18n.tsx`) so they re-render on a language change; shared code, backend and non-render callbacks import `t`/`tp` from `@shared/i18n`.
- Labels declared in constants are marked with `msg('...')` and translated where rendered with `t(label)`. Operation definitions stay plain English and `FieldControl`/pages call `t()` on them.
- Counts use `tp(count, one, other)`; the key is the `other` form, and Arabic entries supply CLDR plural forms (`one`, `two`, `few`, `many`, `other`).
- A `context|` prefix (e.g. `action|Start`, `theme|Light`) separates identical English words that translate differently; it is stripped on fallback.
- Never branch on message text: it is translated (e.g. skipped jobs use `JobSnapshot.skipped`).
- `tests/core/i18n.test.ts` scans the source for `t`/`tp`/`msg` literals and the operation registry, and fails on missing, stale or placeholder-mismatched entries. Keep the first argument of those calls a string literal.
- Arabic is RTL (`dir` set on `<html>`): use logical CSS properties (`margin-inline-start`, `inset-inline-end`, `text-align: start`), mirror direction-dependent transforms with `:dir(rtl)`, and keep commands/paths `dir="ltr"`.

### Settings

`SettingsStore` (`backend/settings`) persists JSON through the `read_settings`/`write_settings` Rust commands; values on disk are treated as untrusted and run through `settings/sanitize.ts` on load and on every patch. Presets are stored per operation and normalized with `normalizeOptions`.

## Conventions

- ESLint enforces: no `any`, no non-null assertions (`!`), inline `type` imports (`import { type X }`), `eqeqeq` (except `== null`), unused vars prefixed `_`, and a **260-line max per file** (warning, but warnings fail lint) — split large files rather than growing them.
- Security posture to preserve: strict CSP (in `tauri.conf.json`), minimal capabilities, only the two bundled binaries can be spawned, absolute-path checks in Rust, outputs-only `showInFolder`/`openPath`.
- Packaged builds put the sidecars next to the app executable (`Program::path` in `process.rs`); `ffmpeg-static` downloads the binary for the host platform, so installers must be built on their target OS.
