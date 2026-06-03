# Yandex Games Release

## What is published

Yandex Games receives only the static client build:

- `dist-yandex/index.html`
- `dist-yandex/assets/`
- static files copied by Vite from `public/`

The `backend/` folder, root `node_modules/`, `.env*` files, source files, tests, and dev logs are not copied into `dist-yandex` and are not packaged into the upload zip.

The Yandex build currently disables the leaderboard UI and automatic leaderboard saves. The existing backend and Yandex leaderboard code stay in the repository for normal development and a later release.

## Build it yourself

From the repository root:

```powershell
npm install
npm run package:yandex
```

`package:yandex` runs these steps in order:

1. `npm run build:yandex` builds the Vite client in Yandex mode into `dist-yandex/`.
2. `npm run validate:yandex` validates the upload folder.
3. `scripts/package-yandex.ps1` creates `game-yandex.zip` with URL-safe `/` zip entry separators.
4. `scripts/validate-yandex-archive.ps1` validates the upload archive structure.

Upload this archive in the Yandex Games console:

```text
game-yandex.zip
```

The archive root contains `index.html` and `assets/`. Do not upload a zip that contains `dist-yandex/` as an extra wrapper folder.

## Check before upload

Run the explicit checks when you want to inspect a build before packaging:

```powershell
npm run build:yandex
npm run validate:yandex
```

The validator checks that:

- `dist-yandex/index.html` exists;
- the SDK is loaded as `/sdk.js` with `onload="initSDK()"`;
- `backend`, `server`, `api`, `node_modules`, and `.env*` files are not in the build;
- output paths have no spaces or Cyrillic characters;
- `dist-yandex` stays below 100 MB;
- Vite JS/CSS entry assets use relative `./assets/...` paths for Yandex archive hosting;
- built text files do not contain absolute localhost or loopback URLs;
- the backend env name is not bundled into the release output.

To smoke-test the static output locally:

```powershell
python -m http.server 4174 --directory dist-yandex
```

Open `http://127.0.0.1:4174/`. The local server does not provide Yandex `/sdk.js`, so a failed SDK network request in local devtools is expected. The game must still start through the mock SDK fallback.

Use `http://127.0.0.1:4174/?lang=en` to inspect the English local fallback. On Yandex, the language comes from `ysdk.environment.i18n.lang`: `ru` keeps Russian, every other language uses English.

## Integrated platform behavior

- `index.html` declares the Yandex SDK script as `/sdk.js`; the SDK file is not stored in the repository.
- App bootstrap waits for the SDK script result and `YaGames.init()` before mounting the game when the real SDK exists.
- `src/platform/yandexGames.ts` is the game-facing Yandex integration layer.
- `LoadingAPI.ready()` is emitted after the Pixi app has loaded its main textures and rendered the first scene.
- Fullscreen and rewarded ad calls stay inside the platform wrapper; after a loss, rewarded video offers 10 extra moves, and interstitials are requested only on terminal player transitions with a 70-second client cooldown.
- Gameplay pause/resume and audio holds are coordinated around ads and page visibility.
- `visibilitychange` pauses gameplay timing/input and suspends audio without overriding a user mute setting.
- Player progress is saved through Yandex player data for authorized players and through local storage only for guests.
- The start screen offers a Yandex ID sign-in action for cloud saves across devices and syncs local progress into the authorized player profile after login.

## Maintenance notes

Use the regular dev commands for non-Yandex work:

```powershell
npm run dev
npm run test
npm run lint
npm run build
```

The Yandex-specific Vite mode is selected only by `npm run build:yandex`. `.env.yandex` clears `VITE_LEADERBOARD_BACKEND_URL` for that mode. Do not put backend URLs into a Yandex mode env file.

## Remaining manual checks

- Run the build inside the Yandex Games console test environment before publishing so `/sdk.js`, ad callbacks, and platform focus behavior are exercised against the real SDK.
- Review the English copy on all gameplay overlays before opening non-Russian locales. Main gameplay, start, tutorial, level map, pause/win/loss/final overlays, and shared result screens are localized; the disabled leaderboard panel remains outside this Yandex release.
- If the leaderboard is enabled later, configure the leaderboard in the Yandex console first and remove the Yandex-mode disable switch deliberately.
- The app still references Google Fonts and social preview URLs in client metadata/CSS. Verify Yandex moderation accepts those network references or self-host/remove them before upload if moderation flags them.
