# Architecture

## Current Structure

```text
.
├── .github/
│   └── copilot-instructions.md
├── assets/
│   ├── .gitkeep
│   └── icon.png
├── src/
│   ├── main/
│   │   ├── logger.js
│   │   └── main.js
│   ├── preload/
│   │   └── preload.js
│   ├── renderer/
│   │   ├── index.html
│   │   ├── renderer.js
│   │   └── styles.css
│   └── shared/
│       └── .gitkeep
├── test/
│   └── smoke.test.js
├── .gitignore
├── package-lock.json
├── package.json
├── README.md
└── stage5-progress.html
```

## Implemented

- `package.json` sets `src/main/main.js` as the Electron entry point. The `start` script launches Electron; `test` uses Node's built-in test runner.
- `src/main/main.js` owns the Electron app lifecycle and creates the 900x700 `BrowserWindow`. It loads `src/renderer/index.html`, sets the app icon from `assets/icon.png`, and logs uncaught exceptions, unhandled rejections, and renderer-process termination.
- The window uses `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. Its preload is `src/preload/preload.js`.
- `src/preload/preload.js` uses `contextBridge` to expose only `window.appInfo = { name: "Self Tracker" }` to the renderer.
- `src/renderer/index.html` contains the navigation shell and page markup. It loads `styles.css` and loads `renderer.js` with `defer`.
- `src/renderer/renderer.js` switches among the 15 navigation sections and owns the Workouts form and history rendering. Workout entries are stored in renderer `localStorage` under the key `entries` as JSON records with `date`, `muscle`, and `intensity` fields. This is the current persistence implementation.
- `src/renderer/styles.css` contains the renderer's layout and responsive styles.
- `src/shared/` is currently a placeholder directory; it contains only `.gitkeep` and has no shared runtime code yet.
- `assets/icon.png` is the current app/window icon. `assets/.gitkeep` keeps the asset directory present in Git.
- `src/main/logger.js` appends ISO-timestamped messages to `app.getPath("userData")/logs/app.log`, creating the logs directory when needed. Logging failures are caught so they do not interrupt the app.
- `src/main/db/probe.js` verifies built-in SQLite availability by opening an in-memory `DatabaseSync` and returning `SELECT sqlite_version()`. `src/main/main.js` logs that version during startup.
- `src/main/db/probe.js` verifies built-in SQLite availability by opening an in-memory `DatabaseSync` and returning `SELECT sqlite_version()`. `src/main/main.js` logs that version during startup.
- `src/main/db/connection.js` opens a `DatabaseSync` at the requested location, enables foreign keys, sets a 5000 ms busy timeout, and makes close idempotent. `src/main/main.js` opens `:memory:` after app readiness and closes it before quit, logging both lifecycle events.
- `test/smoke.test.js` checks the start script and the configured main, preload, and renderer entry-point files.
- `test/sqlite-available.test.js` checks that the SQLite probe returns a non-empty version string.
- `test/sqlite-available.test.js` checks that the SQLite probe returns a non-empty version string.
- `test/connection.test.js` checks the foreign-key and busy-timeout pragmas and repeated close.

On this Windows installation, the log file is at `%APPDATA%\self-tracker\logs\app.log`. The application code resolves the location from Electron's `userData` path rather than hard-coding this Windows path.

## Planned

- **M3 persistent database — decided, not yet implemented:** `node:sqlite` is the selected module and its availability has been verified in Electron; see M3-001 and M3-002 below. The current probe only opens an in-memory database. No persistent connection, schema, or database file exists yet. Database code is planned under `src/main/db/`, and the database file is planned at `userData/self-tracker.db`.
- **M3 persistent database — decided, not yet implemented:** `node:sqlite` is the selected module and its availability has been verified in Electron; see M3-001 and M3-002 below. M3-003 currently opens and closes only an in-memory database for lifecycle verification. No userData-backed database file, schema, or migrations exist yet. Persistent database work remains planned under `src/main/db/`, with the database file planned at `userData/self-tracker.db`.
- Later M3 tasks cover the database connection, user-data storage location, schema versioning, migrations, repositories, and safe database access through preload. These remain planned work.

## Decisions

### M3-001 — Local database (2026-10-04)

- **Decision:** Use Node's built-in `node:sqlite` (`DatabaseSync`) in the Electron main process.
- **Why:** It needs no native module compilation on Windows. Electron 44.5.1 and system Node are both v24.21.0, so the app and `npm test` run the same SQLite code. It adds zero dependencies, and synchronous calls suit a local single-user app.
- **Risk and mitigation:** `node:sqlite` is a release candidate and its API may change. Keep all database code in `src/main/db/` so the implementation can be swapped.
- **Fallback:** If M3-002 had found that `node:sqlite` did not load in Electron, the fallback would be `better-sqlite3` with `@electron/rebuild`. M3-002 verified that the built-in module loads, so no fallback package was installed.
- **Database file:** Planned at `userData/self-tracker.db`.

### M3-002 — SQLite runtime availability (2026-10-04)

- **Result:** Verified `node:sqlite` inside the Electron 44.5.1 main process. An in-memory `DatabaseSync` query returned SQLite version `3.53.4`.
- **Startup log:** The app writes the SQLite version to `userData/logs/app.log`.
- **Test:** `npm test` passes, including the non-empty SQLite version assertion.
- **Scope:** This verifies runtime availability only; persistent database setup remains planned.
- **Scope:** This verifies runtime availability only; M3-003 adds an in-memory connection lifecycle, while persistent database setup remains planned.

### M3-003 — In-memory connection lifecycle (2026-10-04)

- **Result:** The main process opens `:memory:` after app readiness and closes the connection during `before-quit`.
- **Configuration:** Foreign keys are enabled and the SQLite busy timeout is 5000 ms. Calling `closeDatabase` twice is safe.
- **Verification:** `npm test` passes; `app.log` contains both database lifecycle messages.

## Run And Test

From the repository root:

```powershell
npm install
npm start
npm test
```

`npm start` opens the Electron desktop app. `npm test` runs the smoke test with Node's built-in test runner; no separate test dependency is used.

## Progress

See the [Stage 5 progress tracker](stage5-progress.html) for task status, ownership, dependencies, and verification notes.
