---
type: investigation
status: verified
updated: 2026-07-15
tags:
  - github-pages
  - vite
  - workers
---

# GitHub Pages deployment

## Цель

Опубликовать полноэкранный `ControlApp` как статическое приложение под repository subpath `/alphaTab/`, сохранив score rendering, AlphaSynth playback, Practice, Perform и Web MIDI.

## Найденная проблема

Обычная Vite-сборка загружала интерфейс, Bravura и стартовый `.gp`, однако score surface оставался пустым, `isReadyForPlayback` был `false`, а Play — disabled. Ошибок main thread console не было.

В production bundle `Environment.scriptFile` указывал на главный application chunk. Renderer и synth создавали workers, но worker URL не были превращены в отдельные build assets. Создание `Worker` само по себе успешно даже для URL, который позднее не загрузится, поэтому штатный fallback не срабатывал синхронно.

## Решение

- использовать `alphaTab()` из собственного Vite plugin проекта;
- собирать `packages/alphatab/dist` перед Pages application, чтобы plugin обрабатывал опубликованную split-runtime структуру `alphaTab.mjs`, `alphaTab.core.mjs`, worker и worklet;
- переопределить exact alias `@coderline/alphatab` на собранный `dist/alphaTab.mjs` только в Pages config;
- получать base path из Pages и строить URL score/font/SoundFont через runtime meta tag;
- копировать runtime assets и лицензии отдельным build script.

## Проверка 2026-07-15

Production preview под `http://127.0.0.1:4173/alphaTab/` подтвердил:

- score `Silent Night (Easy)` загружен и отрисован;
- renderer создал SVG surfaces;
- worker и output готовы, `isReadyForPlayback === true`;
- Play переводит player в `Playing`, Stop возвращает `Idle`;
- browser warning/error log пуст.

Встроенный Browser оставил Web Audio `AudioContext` в `suspended`, поэтому слышимый звук и продвижение позиции должны дополнительно проверяться в обычном пользовательском браузере. Это не заменяет ручной smoke test Web MIDI с физическим устройством.

Связанные заметки: [[05 Development and Testing]], [[07 Risks and Open Questions]], [[Decisions/Decision Log]].
