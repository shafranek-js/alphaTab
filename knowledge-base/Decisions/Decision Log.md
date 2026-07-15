---
type: decision-index
status: active
updated: 2026-07-15
tags:
  - decisions
---

# Журнал решений

## Принятые решения

| Дата | Решение | Статус | Контекст |
|---|---|---|---|
| 2026-07-14 | Хранить постоянную Obsidian-базу в `knowledge-base/` | accepted | База version-controlled, generated facts отделены от curated knowledge. |
| 2026-07-14 | Считать текущий код и tests главным источником истины | accepted | Fork расходится с официальной документацией и upstream. |
| 2026-07-14 | Не выполнять автоматический network fetch в `kb:update` | accepted | Обновление базы должно быть безопасным, быстрым и воспроизводимым офлайн. |
| 2026-07-14 | Развивать приложение сначала как личный инструмент | accepted | Возможный будущий публичный продукт и другие инструменты остаются направлением развития, но не текущим обязательным scope. |
| 2026-07-14 | Фиксировать правила Perform на время активного прохода | accepted | Loop, Ignore octave, Start speed и Target speed меняются только между проходами; визуальные подсказки и MIDI input остаются доступными. |
| 2026-07-15 | Публиковать ControlApp через GitHub Pages из `develop` | accepted | Статический deploy даёт постоянный HTTPS URL без backend; production build обязан включать alphaTab Vite plugin, runtime assets и их лицензии. |

Для нового решения скопировать [[Templates/Decision]] в эту папку и добавить ссылку в таблицу.
