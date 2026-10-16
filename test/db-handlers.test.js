const assert = require("node:assert/strict");
const { test } = require("node:test");
const { closeDatabase, openDatabase } = require("../src/main/db/connection");
const { runMigrations } = require("../src/main/db/migrate");
const migrations = require("../src/main/db/migrations");
const { ensureSchemaVersionTable } = require("../src/main/db/schema");
const { registerDbHandlers } = require("../src/main/ipc/db-handlers");

function createFakeIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, handler) {
      handlers.set(channel, handler);
    },
  };
}

test("database IPC handlers return the schema version and muscle list", () => {
  const database = openDatabase(":memory:");
  const ipcMain = createFakeIpcMain();

  try {
    ensureSchemaVersionTable(database);
    runMigrations(database, migrations);
    database
      .prepare("INSERT INTO muscle (name, group_name) VALUES (?, ?), (?, ?)")
      .run("Test calf", "Legs", "Test chest", "Chest");
    registerDbHandlers(ipcMain, () => database);

    assert.deepEqual([...ipcMain.handlers.keys()].sort(), ["db:schemaVersion", "muscles:list"]);
    assert.equal(ipcMain.handlers.get("db:schemaVersion")(), migrations.at(-1).version);
    assert.deepEqual(ipcMain.handlers.get("muscles:list")(), [
      { id: 2, name: "Test chest", group_name: "Chest" },
      { id: 1, name: "Test calf", group_name: "Legs" },
    ]);
  } finally {
    closeDatabase(database);
  }
});

test("database IPC handlers fail clearly when the database is closed", () => {
  const ipcMain = createFakeIpcMain();
  registerDbHandlers(ipcMain, () => null);

  assert.throws(() => ipcMain.handlers.get("db:schemaVersion")(), /Database is not open/);
  assert.throws(() => ipcMain.handlers.get("muscles:list")(), /Database is not open/);
});
