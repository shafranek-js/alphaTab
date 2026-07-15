---
type: glossary
status: active
updated: 2026-07-14
tags:
  - glossary
---

# Глоссарий

| Термин | Значение |
|---|---|
| AlphaTabApi | Публичный координационный API между моделью, renderer, player и UI. |
| AlphaSynth | MIDI/SoundFont synthesizer и sequencer alphaTab. |
| alphaTex | Текстовый язык описания партитур alphaTab. |
| Beat | Элемент времени внутри voice/bar, содержащий notes или rest. |
| BoundsLookup | Связь модели с экранными координатами после рендера. |
| Clean pass | Проход Perform/loop без wrong и missed notes. |
| Expected wall timestamp | Ожидаемое время атаки ноты в `performance.now()` timeline. |
| Fresh attack | Новый note-on, необходимый для повторяющейся ноты, в отличие от sustain. |
| Live note | Нота, сыгранная напрямую в synthesizer, вне обычной MIDI sequence партитуры. |
| Playback range | Выбранный диапазон MIDI ticks для воспроизведения или упражнения. |
| Score | Корневой объект музыкальной модели. |
| Step Practice | Режим, который ждёт точный MIDI-ввод и продвигается по нотам без временной шкалы. |
| Perform | Режим реального playback с timing scoring и повышением скорости. |
| TickLookup / tick cache | Индекс соответствия MIDI ticks элементам модели и playback bounds. |
| Tie destination | Продолжение связанной ноты, обычно не требующее новой атаки. |
