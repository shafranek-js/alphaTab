---
type: engineering
status: verified
updated: 2026-07-14
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

## Windows caveats

- Snapshot-файлы могут выглядеть изменёнными только из-за LF/CRLF.
- Не восстанавливать такие файлы автоматически без проверки реального diff.
- SoundFont и visual fixtures крупные; не включать их в базу знаний.
