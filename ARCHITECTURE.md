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
│   │   ├── db/
│   │   │   ├── connection.js
│   │   │   ├── migrate.js
│   │   │   ├── migrations/
│   │   │   │   └── index.js
│   │   │   ├── probe.js
│   │   │   └── schema.js
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
│   ├── connection.test.js
│   ├── migrate.test.js
│   ├── schema.test.js
│   ├── smoke.test.js
│   └── sqlite-available.test.js
├── .gitignore
├── package-lock.json
├── package.json
├── README.md
└── stage5-progress.html
```

## Implemented

- `package.json` sets `src/main/main.js` as the Electron entry point. The `start` script launches Electron; `test` uses Node's built-in test runner.
- `src/main/main.js` owns the Electron app lifecycle and creates the 900x700 `BrowserWindow`. It loads `src/renderer/index.html`, sets the app icon from `assets/icon.png`, and logs uncaught exceptions, unhandled rejections, renderer-process termination, and database lifecycle events. At startup it opens `userData/self-tracker.db`, ensures the schema version table, and runs known migrations. If database initialization fails it logs the error, shows an error dialog, and quits.
- The window uses `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. Its preload is `src/preload/preload.js`.
- `src/preload/preload.js` uses `contextBridge` to expose only `window.appInfo = { name: "Self Tracker" }` to the renderer.
- `src/renderer/index.html` contains the navigation shell and page markup. It loads `styles.css` and loads `renderer.js` with `defer`.
- `src/renderer/renderer.js` switches among the 15 navigation sections and owns the Workouts form and history rendering. Workout entries are stored in renderer `localStorage` under the key `entries` as JSON records with `date`, `muscle`, and `intensity` fields. This is the current persistence implementation.
- `src/renderer/styles.css` contains the renderer's layout and responsive styles.
- `src/shared/` is currently a placeholder directory; it contains only `.gitkeep` and has no shared runtime code yet.
- `assets/icon.png` is the current app/window icon. `assets/.gitkeep` keeps the asset directory present in Git.
- `.gitignore` excludes `*.db` so database files are not committed from the project tree.
- `src/main/logger.js` appends ISO-timestamped messages to `app.getPath("userData")/logs/app.log`, creating the logs directory when needed. Logging failures are caught so they do not interrupt the app.
- `src/main/db/probe.js` verifies built-in SQLite availability by opening an in-memory `DatabaseSync` and returning `SELECT sqlite_version()`. `src/main/main.js` logs that version during startup.
- `src/main/db/connection.js` opens a `DatabaseSync` at the requested location, enables foreign keys, sets a 5000 ms busy timeout, and makes close idempotent. The main process uses it for `userData/self-tracker.db` and logs the full path when opening and closing it.
- `src/main/db/schema.js` creates `schema_version(version INTEGER NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL)` idempotently. `getSchemaVersion` returns the highest recorded version, or `0` when the table has no rows. The main process ensures the table at startup.
- `src/main/db/migrate.js` sorts migrations by version, skips versions already recorded in `schema_version`, and applies each pending migration in its own transaction. It records the migration name, version, and ISO timestamp, rolls back a failed migration, and rejects databases newer than the known migration list. `src/main/db/migrations/index.js` currently exports an empty list.
- `test/smoke.test.js` checks the start script and the configured main, preload, and renderer entry-point files.
- `test/sqlite-available.test.js` checks that the SQLite probe returns a non-empty version string.
- `test/connection.test.js` checks the foreign-key and busy-timeout pragmas and repeated close.
- `test/schema.test.js` checks schema_version columns, idempotent creation, and schema-version lookup.
- `test/migrate.test.js` checks migration ordering, skipping applied migrations, rollback on failure, and rejection of a newer database version.

On this Windows installation, the log file is at `%APPDATA%\self-tracker\logs\app.log`. The application code resolves the location from Electron's `userData` path rather than hard-coding this Windows path.

## Planned

- **Domain schema and data access — planned:** Add versioned migration entries, domain tables, repositories, and safe preload access in later M3 tasks. The migration runner is implemented, but its migration list is currently empty and no domain tables exist yet.

## Decisions

### M3-001 — Local database (2026-10-04)

- **Decision:** Use Node's built-in `node:sqlite` (`DatabaseSync`) in the Electron main process.
- **Why:** It needs no native module compilation on Windows. Electron 44.5.1 and system Node are both v24.21.0, so the app and `npm test` run the same SQLite code. It adds zero dependencies, and synchronous calls suit a local single-user app.
- **Risk and mitigation:** `node:sqlite` is a release candidate and its API may change. Keep all database code in `src/main/db/` so the implementation can be swapped.
- **Fallback:** If M3-002 had found that `node:sqlite` did not load in Electron, the fallback would be `better-sqlite3` with `@electron/rebuild`. M3-002 verified that the built-in module loads, so no fallback package was installed.
- **Database file:** `userData/self-tracker.db`; the M3-004 connection now opens this path.

### M3-002 — SQLite runtime availability (2026-10-04)

- **Result:** Verified `node:sqlite` inside the Electron 44.5.1 main process. An in-memory `DatabaseSync` query returned SQLite version `3.53.4`.
- **Startup log:** The app writes the SQLite version to `userData/logs/app.log`.
- **Test:** `npm test` passes, including the non-empty SQLite version assertion.
- **Scope:** M3-002 verified runtime availability; M3-003 and M3-004 add the connection lifecycle and file location. Persistent schema and migrations remain planned.

### M3-003 — Database connection lifecycle (2026-10-04)

- **Result:** The main process opens and closes a `DatabaseSync` connection during the Electron app lifecycle.
- **Configuration:** Foreign keys are enabled and the SQLite busy timeout is 5000 ms. Calling `closeDatabase` twice is safe.
- **Verification:** M3-003 tested the connection with `:memory:`; file location was added in M3-004.

### M3-004 — User data database file (2026-10-04)

- **Location:** `app.getPath("userData")/self-tracker.db`; on this Windows machine, `C:\Users\Admin\AppData\Roaming\self-tracker\self-tracker.db`.
- **Lifecycle:** The main process creates the userData directory if needed, logs the full path, opens the database at startup, and closes it before quit. An open failure is logged, shown in an error dialog, and followed by app quit.
- **Verification:** The file exists outside the repository, the app reopened it on a second start, and `app.log` recorded open and close messages.

### M3-005 — Schema version table (2026-10-04)

- **Result:** Startup creates the `schema_version` table with non-null `version`, `name`, and `applied_at` columns. Creation is safe to repeat.
- **Version lookup:** `getSchemaVersion` returns the highest version or `0` for a new/empty table.
- **Verification:** `npm test` passed; the app started twice against the same userData database without errors, and a new database reported version `0`.

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
