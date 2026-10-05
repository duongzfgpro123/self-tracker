const { app, BrowserWindow, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { createLogger } = require("./logger");
const { getSqliteVersion } = require("./db/probe");
const { closeDatabase, openDatabase } = require("./db/connection");
const { ensureSchemaVersionTable } = require("./db/schema");
const { runMigrations } = require("./db/migrate");
const migrations = require("./db/migrations");

const logger = createLogger(() => app.getPath("userData"));
let database;
let databasePath;

process.on("uncaughtException", error => {
  logger.logError("Uncaught exception", error);
  app.exit(1);
});

process.on("unhandledRejection", reason => {
  logger.logError("Unhandled rejection", reason);
});

function createWindow() {
  const window = new BrowserWindow({
    width: 900,
    height: 700,
    icon: path.join(__dirname, "../../assets/icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "../preload/preload.js"),
    },
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    logger.logError("Renderer process gone", details);
  });

  window.loadFile(path.join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  logger.logInfo("Application started");
  logger.logInfo("SQLite version", getSqliteVersion());
  try {
    const userDataPath = app.getPath("userData");
    databasePath = path.join(userDataPath, "self-tracker.db");
    logger.logInfo("Database path", databasePath);
    fs.mkdirSync(userDataPath, { recursive: true });
    database = openDatabase(databasePath);
    ensureSchemaVersionTable(database);
    runMigrations(database, migrations);
  } catch (error) {
    logger.logError("Database initialization failed", error);
    dialog.showErrorBox(
      "Database Error",
      `Could not open or initialize the database at ${databasePath || "the user data path"}.\n\n${error.message}`,
    );
    app.quit();
    return;
  }

  logger.logInfo("Database opened", databasePath);
  createWindow();
});

app.on("before-quit", () => {
  if (!database) return;

  closeDatabase(database);
  logger.logInfo("Database closed", databasePath);
  database = null;
});

app.on("window-all-closed", () => {
  app.quit();
});
