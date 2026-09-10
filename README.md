# Hop and Fill

Browser puzzle game built with React, Vite, PixiJS, and the Yandex Games SDK.

## Встраивание на сайт

Соберите версию для размещения по адресу `/games/hop-and-fill/`:

```bash
npm run build:web
```

Результат появится в `dist-web/`. Эта версия не загружает SDK Яндекс.Игр, не показывает
рекламу, не предлагает вход и хранит прогресс только локально в браузере.

## Yandex package

Create the upload archive with:

```bash
npm run package:yandex
```

This runs type checking, builds `dist-yandex/`, validates the Yandex output, creates `game-yandex.zip`, and validates the archive structure.
