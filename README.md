# FFmpeg Studio

A calm, modern desktop app for FFmpeg. Drop in as many files as you like, pick an operation, press **Start** —
every file becomes its own job in a parallel queue with live progress, speed and ETA.

FFmpeg and FFprobe ship with the app (`ffmpeg-static`, `ffprobe-static`), so there is nothing else to install.

- 23 operations: convert, compress, change codec (H.264/H.265/VP9/AV1), resize, frame rate, trim, merge, extract
  audio, replace/remove audio, add/extract subtitles, watermark, extract frames, images → video, GIF, rotate/flip,
  crop, speed, volume/normalize, video filters, audio filters, metadata & cover art, and a media info viewer.
- Multi-file everywhere, including secondary inputs (e.g. many videos + one watermark, or one soundtrack per video).
- Job queue with configurable concurrency, cancel/retry, full FFmpeg logs, and a desktop notification when a batch ends.
- Exact generated command (copyable) plus extra arguments, presets per operation, and remembered settings.
- Dark and light themes that follow the system, custom frameless window, keyboard shortcuts.

## Requirements

- Node.js 22 or newer (tested with Node 24) and npm 10+
- Rust (stable, via [rustup](https://rustup.rs)) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
  for your platform. On Windows that is the Visual Studio C++ Build Tools ("Desktop development with C++").
- Windows 10+ (WebView2, preinstalled on Windows 11), macOS 12+ or a Linux desktop with WebKitGTK 4.1

## Getting started

```bash
npm install
npm run dev
```

`npm install` downloads the FFmpeg binaries for your platform (`ffmpeg-static`, `ffprobe-static`). `npm run dev` copies
them into `src-tauri/binaries/` (see `scripts/prepare-binaries.mjs`), starts Vite and opens the app. If a binary is
missing, run `npm rebuild ffmpeg-static`.

## Scripts

| Script                     | What it does                                                                  |
| -------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`              | Opens the app with hot reload for the UI (Rust changes rebuild automatically) |
| `npm run build`            | Type-checks both projects and builds the UI into `out/renderer`               |
| `npm run lint`             | ESLint (typescript-eslint strict + React hooks rules), zero warnings allowed  |
| `npm run format`           | Formats the project with Prettier                                             |
| `npm test`                 | Unit tests (Vitest), including a test suite for every operation's `buildArgs` |
| `npm run test:integration` | Runs every operation against the bundled FFmpeg on generated sample media     |
| `npm run package`          | Builds the installer for the current platform with the Tauri bundler          |

Installers are written to `src-tauri/target/release/bundle/` (NSIS on Windows). `ffmpeg-static` downloads the binary
for the machine running `npm install`, so build each platform's installer on that platform (for example with a CI
matrix). The app icons in `src-tauri/icons/` are generated from `build/icon.png` with
`npx tauri icon build/icon.png -o src-tauri/icons`.

## Architecture

The app is a [Tauri 2](https://v2.tauri.app) shell: the UI runs in the system webview (WebView2 on Windows), so the
app does not ship its own browser engine.

```
src/
  renderer/   React UI: components, hooks, pages, state providers and styles (CSS Modules + design tokens)
  backend/    Implements the `StudioApi` used by the UI: job queue, probing, thumbnails, settings. Runs in the webview
              and is the only code that talks to Tauri
  shared/     Types, the `StudioApi` contract, operation definitions and pure helpers
src-tauri/    Rust: runs the bundled ffmpeg/ffprobe, file system helpers, settings file, window and installer config
tests/        Vitest unit tests and the opt-in FFmpeg integration suite
```

**Security.** A strict CSP, no remote content, and a minimal Tauri capability set (`src-tauri/capabilities`). The
webview can only start the two bundled binaries — the Rust side takes `ffmpeg` or `ffprobe`, never a path — and they
always run with an argument array, never through a shell. Jobs are never built from a raw command: the backend
normalizes the operation id, options and file paths against the operation definition and rebuilds the arguments
with the same pure function the UI uses for its preview. File system commands only accept absolute paths, and the UI
can only open job outputs and their folders.

**Jobs.** `planJobs` splits a batch into jobs (one per file, or one combined job for merge and images → video) and
distributes secondary files (`all` or `paired`). The queue runs up to _N_ processes, parses `-progress pipe:1` against
the FFprobe duration (or the operation's `expectedDuration`), and keeps stderr for the log panel. Output names come
from the naming pattern; collisions are resolved as _keep both_, _replace_ or _skip_.

## Adding a new operation

Create **one file** in `src/shared/operations/definitions/`. It is discovered automatically (via `import.meta.glob`),
appears in the sidebar, gets a generated settings form, presets, the command preview and queue support.

```ts
// src/shared/operations/definitions/reverse.ts
import { defineOperation } from '../types';
import { audioEncoderFor, videoEncoderArgs } from '../helpers/encoders';
import { h264Container, primaryFile } from '../helpers/streams';

type Options = { audio: boolean };

export default defineOperation<Options>({
  id: 'reverse',
  label: 'Reverse',
  description: 'Play videos backwards.',
  category: 'effects', // convert | edit | audio | effects | tools
  icon: 'Rewind', // any lucide-react icon name (type-checked)
  order: 10,
  batch: 'perFile', // or 'combine' for one job using every file
  input: { accept: ['video'] },
  outputSuffix: 'reversed', // value of the {op} naming token
  options: [{ key: 'audio', type: 'toggle', label: 'Reverse audio too', default: true }],
  outputExtension: (_o, file) => h264Container(file),
  validate: (_o, inputs) => ((primaryFile(inputs).duration ?? 0) > 600 ? 'Reverse works best on clips under 10 minutes.' : null),
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    const container = h264Container(file);
    return [
      '-i',
      file.path,
      '-vf',
      'reverse',
      ...(o.audio && file.hasAudio ? ['-af', 'areverse', ...audioEncoderFor(container)] : ['-an']),
      ...videoEncoderArgs('h264', 20, 'medium', container),
      ctx.output, // the output path must always be the last argument
    ];
  },
});
```

Field types: `select`, `segmented`, `slider`, `number`, `toggle`, `text`, `time`, `color`, `anchor` (9-position
picker) and `dimensions` (width × height with aspect lock). Any field can use `visibleWhen`. Secondary inputs are
declared with `extraSlots` (see `watermark.ts` or `replace-audio.ts`).

Then add a test in `tests/operations/` (the registry test already checks that defaults produce well-formed arguments),
and optionally a case in `tests/integration/ffmpeg.test.ts` to run it through the real FFmpeg.

Write labels, descriptions and choices in English; the UI translates them at render time. Add the Arabic and Turkish
versions to `src/shared/i18n/locales/{ar,tr}/operations.ts` (`tests/core/i18n.test.ts` lists anything missing).
Messages returned from `validate` go through `t()` from `src/shared/i18n`.

## Keyboard shortcuts

| Shortcut              | Action                          |
| --------------------- | ------------------------------- |
| `Ctrl/⌘ + O`          | Add files                       |
| `Ctrl/⌘ + Enter`      | Start the batch                 |
| `Ctrl/⌘ + B`          | Toggle the sidebar              |
| `Ctrl/⌘ + J`          | Toggle the job queue            |
| `Esc`                 | Close dialogs, menus, dropdowns |
| `Alt + ↑/↓` on a file | Reorder                         |
| `Delete` on a file    | Remove it from the batch        |

## License

The app code is MIT licensed. The bundled FFmpeg builds are licensed under the GPL; see the `ffmpeg-static` and
`ffprobe-static` packages for details and obligations when redistributing.
