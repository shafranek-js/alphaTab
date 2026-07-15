---
type: repository
status: verified
updated: 2026-07-14
tags:
  - git
  - upstream
  - fork
---

# Fork и официальный upstream

## Репозитории

- Рабочий origin: `https://github.com/shafranek-js/alphaTab.git`
- Официальный upstream: `https://github.com/CoderLine/alphaTab.git`
- Рабочая ветка: `develop`

На момент первоначального наполнения базы:

- fork содержит 63 коммита после общей базы, отсутствующих в upstream;
- upstream содержит 34 коммита, отсутствующих в fork;
- общая база: `c41b27a6f9309323ce5fc5e748b356ca4eaa989b`;
- локальный HEAD: `371edb10dfa057361dae488c969ee7cb2c71e584`.

Эти числа исторические и должны сверяться с [[_generated/Repository Snapshot]] или явным network fetch.

## Характер fork-only изменений

Основные темы:

- полнофункциональный playground player UI;
- theme, score display и track settings;
- instrument/balance/transposition controls;
- settings/score persistence;
- virtual piano и Web MIDI;
- Step Practice и Perform;
- live-note, seek, timing и output fixes в synth;
- visual feedback и Suzuki note coloring.

## Upstream-only темы на момент анализа

Среди отсутствующих изменений были обновления зависимостей, исправления player buffering, MusicXML percussion, rendering/layout и новые display settings.

## Стратегия будущей синхронизации

1. Не выполнять blind merge в `develop`.
2. Сначала обновить upstream ref и сохранить точный merge base.
3. Разделить конфликтные зоны: core/synth, playground, dependencies/generated files.
4. Составить behavior checklist для practice и live MIDI до merge.
5. Интегрировать небольшими логическими группами.
6. После каждой группы запускать соответствующие tests.
7. Обновить эту заметку и создать decision record.
