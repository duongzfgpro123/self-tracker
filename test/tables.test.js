const assert = require("node:assert/strict");
const { test } = require("node:test");
const { closeDatabase, openDatabase } = require("../src/main/db/connection");
const { runMigrations } = require("../src/main/db/migrate");
const migrations = require("../src/main/db/migrations");
const { ensureSchemaVersionTable } = require("../src/main/db/schema");

const NOW = "2026-10-16T00:00:00.000Z";

function createMigratedDatabase() {
  const database = openDatabase(":memory:");
  ensureSchemaVersionTable(database);
  runMigrations(database, migrations);
  return database;
}

test("user_profile allows only id 1 and known units", () => {
  const database = createMigratedDatabase();

  try {
    const insertProfile = database.prepare(
      "INSERT INTO user_profile (id, display_name, units, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    );
    insertProfile.run(1, "Tester", "lb", NOW, NOW);
    assert.equal(database.prepare("SELECT units FROM user_profile WHERE id = 1").get().units, "lb");

    assert.throws(() => insertProfile.run(2, "Second", "kg", NOW, NOW), /CHECK constraint failed/);
    database.exec("DELETE FROM user_profile");
    assert.throws(() => insertProfile.run(1, "Tester", "stone", NOW, NOW), /CHECK constraint failed/);

    database
      .prepare("INSERT INTO user_profile (id, created_at, updated_at) VALUES (1, ?, ?)")
      .run(NOW, NOW);
    assert.equal(database.prepare("SELECT units FROM user_profile WHERE id = 1").get().units, "kg");
  } finally {
    closeDatabase(database);
  }
});
