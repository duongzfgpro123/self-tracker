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

- **M3 local database:** a local SQLite database is planned, but database choice and design have not been implemented. Task `M3-001` is responsible for choosing the database and recording the final decision. No database package, connection, schema, or database file exists in the current implementation. Do not treat SQLite as a final choice until M3-001 is completed.
- Later M3 tasks cover the database connection, user-data storage location, schema versioning, migrations, repositories, and safe database access through preload. These remain planned work.

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
