---
type: map
status: active
updated: 2026-07-14
tags:
  - alphatab
  - moc
---

# alphaTab — база знаний

Эта база предназначена для долговременной работы людей и Codex с репозиторием. Код и тесты являются источником истины; заметки объясняют связи, контекст и историю решений.

## Начать отсюда

- [[01 Project Overview]] — назначение продукта и границы проекта.
- [[02 Architecture]] — путь от входного файла до нот, MIDI и звука.
- [[03 Playground and Practice]] — кастомный UI, MIDI, Step Practice и Perform.
- [[04 Package Map]] — пакеты monorepo и их ответственность.
- [[05 Development and Testing]] — команды, CI и стратегия проверки.
- [[06 Fork and Upstream]] — расхождение с официальным alphaTab.
- [[07 Risks and Open Questions]] — текущие технические риски и вопросы.
- [[08 Sources]] — первичные и вторичные источники.
- [[09 Update Protocol]] — как поддерживать базу актуальной.
- [[Glossary]] — термины домена.

## Живое состояние

- [[_generated/Repository Snapshot]]
- [[_generated/Package Matrix]]
- [[_generated/Recent Changes]]

## Память работы

- [[Decisions/Decision Log]]
- [[Investigations/README|Investigations]]

## Правило доверия

При конфликте источников использовать приоритет:

1. Исполняемый код и тесты текущего `HEAD`.
2. Сгенерированные снимки `_generated`.
3. Курируемые заметки этого vault.
4. Локальные README и handoff-документы.
5. Официальная документация соответствующей версии.
6. Исторические отчёты и внешние сравнения.
