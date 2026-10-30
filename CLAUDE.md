# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

FFmpeg Studio is an Electron + React + TypeScript desktop GUI for FFmpeg, built with electron-vite. FFmpeg/FFprobe binaries come from `ffmpeg-static` / `ffprobe-static` (the only runtime `dependencies`; everything else is bundled).

## Commands

```bash
npm run dev                # Electron with renderer hot reload
npm run build              # typecheck (both tsconfigs) + electron-vite build into out/
npm run typecheck          # tsc for tsconfig.node.json (main/preload/shared/tests) and tsconfig.web.json (renderer/shared)
npm run lint               # ESLint, --max-warnings 0 (warnings fail)
npm run format             # Prettier (printWidth 140, single quotes, trailing commas)
npm test                   # Vitest unit tests (tests/**, excluding tests/integration)
npm run test:integration   # Runs operations through the real bundled FFmpeg on generated media (slow, 120s timeouts)
npm run package:win        # Installer via electron-builder -> release/<version>/
```

Single test file / single test: `npx vitest run tests/operations/edit.test.ts` or `npx vitest run -t "trim"`. For integration: `npx vitest run --config vitest.integration.config.mts -t "<name>"`.

If Electron or FFmpeg binaries are missing after install: `npm rebuild electron ffmpeg-static`.

## Architecture

Four source roots with a strict boundary:

- `src/main/` – Electron main process: lifecycle (`index.ts` wires everything), window, IPC handlers, job queue, FFmpeg/FFprobe runners, settings store (electron-store).
- `src/preload/` – the only bridge; exposes the typed `StudioApi` as `window.studio`. Must build to a single CJS file (sandboxed preload).
- `src/renderer/` – React UI. Talks to the system only via `studio` from `lib/api.ts`. State lives in context providers under `state/` (files, jobs, settings, toasts). Styling is CSS Modules (camelCase class names) + design tokens in `styles/tokens.css`.
- `src/shared/` – pure code used by both sides, imported via the `@shared/*` alias: types, the IPC contract, operation definitions, job planning/command helpers. Must not import Electron or Node-only APIs that the renderer can't use.

### IPC contract

`src/shared/ipc.ts` defines every channel name (`IPC`) and the `StudioApi` interface. Adding an IPC call means touching: `shared/ipc.ts` (channel + API type) → `preload/index.ts` (bridge) → a `main/ipc/register-*.ts` file (handler). Handlers are registered with `handle()` from `main/ipc/handle.ts`, which checks the sender is our own renderer and wraps results in an `IpcResult` envelope. Throw `UserError` (from `main/log.ts`) for messages that should reach the user verbatim; any other error is logged and replaced with a generic message. All arguments from the renderer are treated as untrusted and validated in main.

### Operations (the core extension point)

Each file in `src/shared/operations/definitions/` default-exports `defineOperation<Options>({...})` and is auto-discovered by `registry.ts` via `import.meta.glob` — no registration step. A definition declares its option fields (the UI form is generated from them), optional `extraSlots` for secondary inputs (`all` vs `paired` distribution), `outputExtension`, `validate`, `expectedDuration`, and a pure `buildArgs(options, inputs, ctx)`.

Rules for `buildArgs`: return FFmpeg args without the binary and without global flags; **the output path (`ctx.output`) must be the last argument** — `assembleArgs` in `shared/jobs/command.ts` relies on this to insert global/progress flags at the front and user extra args just before the output. Reuse helpers in `operations/helpers/` (`encoders.ts`, `streams.ts`, `filters.ts`). See the README's "Adding a new operation" section for a full example; add tests in `tests/operations/` (the registry test already checks every operation's defaults produce well-formed args).

### Batch → jobs flow

The same pure shared functions run in two places, which keeps the UI preview identical to what executes:

1. Renderer preview (`hooks/useBatchPreview.ts`): `planJobs` → `plannedOutputPath` → `buildArgs` → `assembleArgs` → `formatCommand` to show the exact command.
2. Main execution (`main/queue/create-jobs.ts`): the renderer sends only operation id, options, file paths, output settings and extra-args text — **never a command**. Main re-probes files, runs `normalizeOptions` (coerces/clamps untrusted values against the field schema), `planJobs`, `validate`, resolves output collisions (`output-path.ts`, overwrite/rename/skip, tracking reserved paths), and rebuilds args.

`JobQueue` (`main/queue/job-queue.ts`) runs up to N concurrent `spawn` processes (argument arrays, never a shell), parses `-progress pipe:1` against the expected duration, keeps stderr as the job log, emits `JobEvent`s to the renderer (throttled), deletes partial outputs on failure (except image sequences), and fires a desktop notification when a batch ends.

### Settings

`SettingsStore` persists via electron-store; values on disk are treated as untrusted and run through `settings/sanitize.ts` on load and on every patch. Presets are stored per operation and normalized with `normalizeOptions`.

## Conventions

- ESLint enforces: no `any`, no non-null assertions (`!`), inline `type` imports (`import { type X }`), `eqeqeq` (except `== null`), unused vars prefixed `_`, and a **260-line max per file** (warning, but warnings fail lint) — split large files rather than growing them.
- Security posture to preserve: `contextIsolation`, `sandbox`, no `nodeIntegration`, strict CSP, blocked navigation/permissions, sender checks on every IPC handler.
- Packaged builds run binaries from `app.asar.unpacked` (`main/ffmpeg/binaries.ts` + `asarUnpack` in `electron-builder.yml`); `ffmpeg-static` downloads the binary for the host platform, so installers must be built on their target OS.
