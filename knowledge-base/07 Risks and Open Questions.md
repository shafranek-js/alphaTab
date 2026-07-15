---
type: risk-register
status: active
updated: 2026-07-14
tags:
  - risks
  - questions
---

# Риски и открытые вопросы

## Высокий приоритет

### Расхождение с upstream

Fork и upstream развиваются независимо. Отложенное объединение увеличивает вероятность конфликтов в player, rendering, dependencies и generated code.

### Связка live MIDI и score playback

Practice/Perform используют live notes одновременно с AlphaSynth playback. Ошибки могут проявляться как двойной звук, buzzing, зависшие voices, неправильная transposition или преждевременный note-off.

Текущие защиты: source-aware MIDI note lifecycle, освобождение нот при смене/отключении input, агрегирование одинакового pitch нескольких устройств и сохранение валидного channel `0`. Риск остаётся для browser/audio timing и реальных устройств.

### Временные настройки Perform

Perform меняет playback range, speed, loop, metronome, count-in и mute/solo. Любой ранний выход должен восстановить snapshot ровно один раз и не сохранить временные значения в `localStorage`.

Session-defining controls заблокированы во время прохода, а `PerformSession.configure()` не сбрасывает активную скорость. Риск восстановления snapshot при асинхронных выходах остаётся и требует интеграционных сценариев.

## Закрытые findings 2026-07-14

- Одновременные beats разных staves объединяются в одно order-independent упражнение.
- Одинаковый pitch нескольких staves требует одного нажатия и подсвечивается во всех source beats.
- MIDI input switch/disconnect/dispose освобождают активные ноты.
- Channel `0` больше не смешивается с fallback channel.
- Правила активного Perform-прохода нельзя изменить до Stop/Finish.
- Переключение Practice/Perform больше не стирает свежие keyboard hints: предыдущий режим закрывается до запуска следующего.
- Tempo cursor создаёт одну отметку на staff и не дублирует её для одновременных voices.

## Средний приоритет

### Версия Node

Локальный Node 20.18 ниже требования Vite 8. Требуется стандартизировать runtime в README/CI/dev environment.

### Документация разных поколений

Публичная документация в основном относится к stable 1.8.x, пакеты имеют версию 1.9.0, а fork содержит дополнительные API assumptions. Нельзя переносить пример из docs без проверки локальных types.

### Недостаток интеграционных тестов

State machines хорошо покрыты unit tests, но реальные browser timing, AudioWorklet, MIDI devices и DOM overlays требуют ручных или browser-level сценариев.

### Локальные historical notes

`handoff.md`, `analysis_results.md` и `code-review-fixes.md` полезны, но отражают конкретные моменты времени. Их утверждения нельзя считать текущей проверкой.

## Открытые продуктовые вопросы

- Какими критериями личный инструмент должен соответствовать перед выходом к широкой аудитории?
- Какие музыкальные инструменты следует поддержать после фортепиано и какие части practice-модели для этого нужно обобщить?
- Нужны ли отдельные framework packages для React/Vue/Svelte/Angular?
- Должен ли Perform оценивать длительность удержания и velocity, а не только attack timing?
- Какой режим strict matching нужен для аккордов и extra notes?
- Нужна ли поддержка microphone pitch detection и native MIDI wrapper?
- Какой SoundFont является поставочным default: SONiVOX или FluidR3 SF3?
- Как планируется регулярно забирать upstream fixes?

Закрытые вопросы переносить в [[Decisions/Decision Log]].
