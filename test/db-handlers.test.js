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
    registerDbHandlers(ipcMain, () => database);

    assert.deepEqual([...ipcMain.handlers.keys()].sort(), [
      "db:schemaVersion",
      "muscles:list",
      "workouts:create",
      "workouts:get",
      "workouts:list",
    ]);
    assert.equal(ipcMain.handlers.get("db:schemaVersion")(), migrations.at(-1).version);

    const muscles = ipcMain.handlers.get("muscles:list")();
    assert.equal(muscles.length, 21);
    assert.deepEqual(Object.keys(muscles[0]), ["id", "name", "group_name"]);
    assert.deepEqual(
      muscles.map(({ name }) => name).slice(0, 2),
      ["Biceps brachii", "Forearm extensors"],
    );
    assert.equal(muscles.at(-1).name, "Posterior deltoid");
  } finally {
    closeDatabase(database);
  }
});

test("database IPC handlers fail clearly when the database is closed", () => {
  const ipcMain = createFakeIpcMain();
  registerDbHandlers(ipcMain, () => null);

  assert.throws(() => ipcMain.handlers.get("db:schemaVersion")(), /Database is not open/);
  assert.throws(() => ipcMain.handlers.get("muscles:list")(), /Database is not open/);
  assert.throws(() => ipcMain.handlers.get("workouts:create")({}, { name: "Push" }), /Database is not open/);
  assert.throws(() => ipcMain.handlers.get("workouts:get")({}, 1), /Database is not open/);
  assert.throws(() => ipcMain.handlers.get("workouts:list")({}), /Database is not open/);
});

test("workout IPC handlers create, read and list workouts with only the allowed fields", () => {
  const database = openDatabase(":memory:");
  const ipcMain = createFakeIpcMain();
  const event = {};

  try {
    ensureSchemaVersionTable(database);
    runMigrations(database, migrations);
    registerDbHandlers(ipcMain, () => database);
    const invoke = (channel, ...args) => ipcMain.handlers.get(channel)(event, ...args);

    const created = invoke("workouts:create", {
      name: " Push day ",
      workout_date: "2026-10-16",
      notes: "Felt strong",
      created_at: "2000-01-01T00:00:00.000Z",
      now: "2000-01-01T00:00:00.000Z",
      id: 99,
    });
    assert.equal(created.name, "Push day");
    assert.equal(created.notes, "Felt strong");
    assert.notEqual(created.id, 99);
    assert.notEqual(created.created_at, "2000-01-01T00:00:00.000Z");
    assert.deepEqual(created.exercises, []);

    assert.deepEqual(invoke("workouts:get", created.id), created);
    assert.equal(invoke("workouts:get", 9999), null);
    assert.deepEqual(invoke("workouts:list"), [
      { id: created.id, name: "Push day", workout_date: "2026-10-16", duration_seconds: null, exercise_count: 0, set_count: 0 },
    ]);

    assert.throws(() => invoke("workouts:create", null), /Workout name is required/);
    assert.throws(() => invoke("workouts:create", "Push day"), /Workout name is required/);
    assert.throws(() => invoke("workouts:create", { name: "Push", workout_date: "2026-13-01" }), /real calendar date/);
    assert.throws(() => invoke("workouts:get", "1"), /Workout id must be a positive integer/);
    assert.equal(invoke("workouts:list").length, 1);
  } finally {
    closeDatabase(database);
  }
});
