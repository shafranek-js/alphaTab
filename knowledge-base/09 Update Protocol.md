---
type: process
status: active
updated: 2026-07-14
tags:
  - maintenance
  - codex
---

# Протокол обновления базы

## Автоматическое обновление

После `git pull`, переключения ветки или существенных изменений запускать:

```bash
npm run kb:update
```

Команда обновляет:

- `_generated/Repository Snapshot.md`;
- `_generated/Package Matrix.md`;
- `_generated/Recent Changes.md`;
- CodeGraph statistics, если CLI доступен;
- проверку всех Obsidian wiki links.

Для проверки ссылок без изменения файлов:

```bash
npm run kb:check
```

## Ручное обновление

Курируемые заметки обновляются при следующих событиях:

| Событие | Что обновить |
|---|---|
| Изменение архитектуры или data flow | [[02 Architecture]] и соответствующая subsystem note |
| Изменение Practice/Perform/MIDI | [[03 Playground and Practice]], risks и tests |
| Добавление/удаление package | [[04 Package Map]] |
| Изменение scripts/CI/runtime | [[05 Development and Testing]] |
| Merge/rebase/upstream sync | [[06 Fork and Upstream]] и decision record |
| Новый риск или снятие риска | [[07 Risks and Open Questions]] |
| Значимое решение | [[Decisions/Decision Log]] |
| Диагностика со знанием на будущее | новая заметка в `Investigations/` |

## Формат доверия

Использовать frontmatter `status`:

- `verified` — проверено по текущему коду/tests;
- `documented` — взято из документации, но не перепроверено в коде;
- `inference` — обоснованный вывод;
- `historical` — верно для указанного commit/date;
- `active` — поддерживаемый индекс, процесс или список;
- `draft` — требует проверки.

## Handoff checklist для Codex

1. Прочитать Home, Repository Snapshot и релевантные notes.
2. После изменений обновить curated notes, если изменилось долговременное знание.
3. Запустить `npm run kb:update`.
4. Убедиться, что `kb:check` проходит.
5. В финальном сообщении отметить, какие знания добавлены или изменены.

## Ограничения

- `_generated/` не редактируется вручную.
- Vault не хранит секреты, бинарные assets, logs, node_modules или содержимое CodeGraph DB.
- Автообновление не делает network fetch upstream; сравнение с upstream запускается осознанно.
