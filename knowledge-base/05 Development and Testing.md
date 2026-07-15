---
type: engineering
status: verified
updated: 2026-07-15
tags:
  - development
  - testing
  - ci
---

# Разработка и тестирование

## Основные команды

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test --workspace=packages/playground
npm run test --workspace=packages/alphatab
npm run build-web
npm run build-pages
npm run build-csharp
npm run build-kotlin
npm run kb:update
```

Vite 8 требует Node.js 20.19+ или 22.12+. Локальный Node 20.18 запускает приложение с предупреждением, поэтому для воспроизводимой разработки требуется обновление runtime.

## Тестовые уровни

- `packages/alphatab/test`: API, audio, exporter, importer, MIDI, model, platform, rendering, visual tests, XML и ZIP.
- `packages/playground/test`: MIDI input, practice/perform state machines, virtual piano, settings storage и Suzuki coloring.
- `packages/transpiler/test`: большая fixture/snapshot matrix для TypeScript constructs и target output.
- C# и Kotlin имеют отдельные native build/test pipelines.
- Vite и Webpack проверяют bundler integration.

## CI

`.github/workflows/build.yml` разделяет проверки на:

- lint + generated TypeScript + typecheck;
- web build/tests + LSP + Monaco;
- C# build/tests на .NET 8;
- Kotlin build/tests через Gradle.

`.github/workflows/pages.yml` собирает alphaTab web package, затем публичный `ControlApp`, загружает `packages/playground/dist-pages` как Pages artifact и разворачивает его из ветки `develop`. Base path берётся из `actions/configure-pages`, поэтому asset URL работают под `/alphaTab/`.

Публичная сборка использует отдельный `packages/playground/vite.pages.config.ts` со штатным alphaTab Vite plugin. Плагин обязан обработать renderer Web Worker и AlphaSynth Web Worker/AudioWorklet; обычная Vite-сборка интерфейса без него внешне загружает score, но не завершает rendering/player initialization. Подробности: [[Investigations/GitHub Pages Deployment]].

`scripts/build-pages.mjs` добавляет в artifact Bravura, FluidR3, стартовую партитуру, `.nojekyll` и лицензии alphaTab/FluidR3. Перед `npm run build-pages` должны быть собраны `packages/alphatab/dist` и `packages/vite/dist`; Pages workflow гарантирует это командами `npm run build` и `npm run build-vite`.

## Пропорциональная проверка изменений

| Область изменения | Минимальная проверка |
|---|---|
| Playground UI | playground typecheck, lint и связанные tests |
| Practice/Perform/MIDI | `PracticeController`, `MidiInputService`, `PianoKeyboard` tests + ручной browser/MIDI smoke test |
| Core model/importer | alphaTab targeted tests + full alphaTab test при изменении shared behavior |
| Rendering | rendering/visual tests и проверка SVG/Canvas |
| Synth/player | audio tests + browser playback, seek, loop, live note и cleanup scenarios |
| Transpiler/shared TS | transpiler fixtures, затем C# и Kotlin build/tests |
| Bundler/platform | соответствующий Vite/Webpack build и worker/worklet smoke test |
| GitHub Pages | `PAGES_BASE_PATH=/alphaTab/ npm run build-pages`, static preview, score render, player ready, Play/Stop и отсутствие browser errors |

## Windows caveats

- Snapshot-файлы могут выглядеть изменёнными только из-за LF/CRLF.
- Не восстанавливать такие файлы автоматически без проверки реального diff.
- SoundFont и visual fixtures крупные; не включать их в базу знаний.
