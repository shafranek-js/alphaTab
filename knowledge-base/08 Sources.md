---
type: sources
status: active
updated: 2026-07-14
tags:
  - sources
---

# Источники

## Первичные локальные источники

- `packages/alphatab/src/` — текущая реализация core.
- `packages/playground/src/` — текущая реализация приложения.
- `packages/*/test/` — исполняемые контракты поведения.
- `package.json` и package manifests — команды и versions.
- `.github/workflows/` — фактический CI.
- `packages/transpiler/docs/` — shared IR и поддерживаемый TypeScript subset.
- Git history и сравнение с upstream.
- CodeGraph index — навигация по symbols и dependencies, но не замена чтению кода.

## Локальная документация

- `README.md`
- `CONTRIBUTING.md`
- `packages/playground/README.md`
- package README для alphaTex, LSP, Monaco, Vite и Webpack
- `handoff.md`, `analysis_results.md`, `code-review-fixes.md` — исторические вторичные источники

## Официальные внешние источники

- [alphaTab documentation](https://www.alphatab.net/docs/introduction)
- [Web configuration and AlphaTabApi](https://alphatab.net/docs/getting-started/configuration-web)
- [Web player tutorial](https://alphatab.net/docs/tutorial-web/player)
- [API reference](https://alphatab.net/docs/reference/api/)
- [Supported formats](https://www.alphatab.net/docs/category/formats/)
- [Contributing and toolchain](https://www.alphatab.net/docs/contributing)
- [Official GitHub repository](https://github.com/CoderLine/alphaTab)
- [Working origin](https://github.com/shafranek-js/alphaTab)

## Правила цитирования

- Для поведения текущего fork ссылаться на локальный файл, symbol и test.
- Для публичного API указывать версию документации и сверять local types.
- Для исторического утверждения указывать commit/date.
- Для вывода или гипотезы явно использовать метку `inference`.
