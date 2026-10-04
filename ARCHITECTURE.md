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
- `test/smoke.test.js` checks the start script and the configured main, preload, and renderer entry-point files.

On this Windows installation, the log file is at `%APPDATA%\self-tracker\logs\app.log`. The application code resolves the location from Electron's `userData` path rather than hard-coding this Windows path.

## Planned

- **M3 local database — decided, not yet implemented:** `node:sqlite` is the selected module; see the M3-001 decision below. No database package, connection, schema, or database file exists in the current implementation. M3-002 must verify that `node:sqlite` loads in Electron before database implementation begins. The database module is planned for `src/main/db/`, and the database file is planned at `userData/self-tracker.db`.
- Later M3 tasks cover the database connection, user-data storage location, schema versioning, migrations, repositories, and safe database access through preload. These remain planned work.

## Decisions

### M3-001 — Local database (2026-10-04)

- **Decision:** Use Node's built-in `node:sqlite` (`DatabaseSync`) in the Electron main process.
- **Why:** It needs no native module compilation on Windows. Electron 44.5.1 and system Node are both v24.21.0, so the app and `npm test` run the same SQLite code. It adds zero dependencies, and synchronous calls suit a local single-user app.
- **Risk and mitigation:** `node:sqlite` is a release candidate and its API may change. Keep all database code in `src/main/db/` so the implementation can be swapped.
- **Fallback:** If M3-002 verification finds that `node:sqlite` does not load in Electron, use `better-sqlite3` with `@electron/rebuild`.
- **Database file:** Planned at `userData/self-tracker.db`.

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
