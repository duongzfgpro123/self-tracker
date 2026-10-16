const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { closeDatabase, openDatabase } = require("../src/main/db/connection");
const { runMigrations } = require("../src/main/db/migrate");
const migrations = require("../src/main/db/migrations");
const { ensureSchemaVersionTable, getSchemaVersion } = require("../src/main/db/schema");

const EXPECTED_TABLES = ["exercise", "exercise_muscle", "goal", "muscle", "schema_version", "user_profile"];
const NOW = "2026-10-16T00:00:00.000Z";

function openMigratedDatabase(location) {
  const database = openDatabase(location);
  ensureSchemaVersionTable(database);
  runMigrations(database, migrations);
  return database;
}

function count(database, table) {
  return database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}

test("file database migrates fully and keeps data across reopen", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "self-tracker-smoke-"));
  const location = path.join(directory, "smoke.db");
  const newestVersion = Math.max(...migrations.map(({ version }) => version));
  let database;

  try {
    database = openMigratedDatabase(location);

    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map(({ name }) => name);
    assert.deepEqual(tables, EXPECTED_TABLES);
    assert.equal(getSchemaVersion(database), newestVersion);
    assert.equal(count(database, "muscle"), 21);

    assert.throws(
      () =>
        database
          .prepare("INSERT INTO exercise_muscle (exercise_id, muscle_id, role) VALUES (?, ?, ?)")
          .run(9999, 9999, "primary"),
      /FOREIGN KEY constraint failed/,
    );

    database
      .prepare("INSERT INTO user_profile (id, display_name, created_at, updated_at) VALUES (1, ?, ?, ?)")
      .run("Smoke tester", NOW, NOW);
    const appliedCount = count(database, "schema_version");
    closeDatabase(database);

    database = openMigratedDatabase(location);
    assert.equal(count(database, "schema_version"), appliedCount);
    assert.equal(getSchemaVersion(database), newestVersion);
    assert.equal(count(database, "muscle"), 21);
    assert.equal(
      database.prepare("SELECT display_name FROM user_profile WHERE id = 1").get().display_name,
      "Smoke tester",
    );
  } finally {
    if (database) closeDatabase(database);
    fs.rmSync(directory, { recursive: true, force: true });
  }

  assert.equal(fs.existsSync(directory), false);
});
