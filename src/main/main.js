const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const { createLogger } = require("./logger");
const { getSqliteVersion } = require("./db/probe");
const { closeDatabase, openDatabase } = require("./db/connection");

const logger = createLogger(() => app.getPath("userData"));
let database;

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
  database = openDatabase(":memory:");
  logger.logInfo("Database opened", { location: ":memory:" });
  createWindow();
});

app.on("before-quit", () => {
  if (!database) return;

  closeDatabase(database);
  logger.logInfo("Database closed");
  database = null;
});

app.on("window-all-closed", () => {
  app.quit();
});
