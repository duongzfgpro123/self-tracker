const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { test } = require("node:test");
const { runMigrations } = require("../src/main/db/migrate");
const { ensureSchemaVersionTable, getSchemaVersion } = require("../src/main/db/schema");

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  ensureSchemaVersionTable(database);
  return database;
}

test("migrations are applied in version order", () => {
  const database = createDatabase();

  try {
    database.exec("CREATE TABLE migration_order (name TEXT NOT NULL)");
    runMigrations(database, [
      { version: 2, name: "second", sql: "INSERT INTO migration_order VALUES ('second')" },
      { version: 1, name: "first", sql: "INSERT INTO migration_order VALUES ('first')" },
    ]);

    assert.deepEqual(
      database.prepare("SELECT name FROM migration_order ORDER BY rowid").all().map(({ name }) => name),
      ["first", "second"],
    );
    assert.equal(getSchemaVersion(database), 2);
    const recordedMigrations = database
      .prepare("SELECT version, name, applied_at FROM schema_version ORDER BY version")
      .all()
      .map(({ version, name, applied_at }) => ({ version, name, applied_at }));
    assert.deepEqual(
      recordedMigrations.map(({ version, name }) => ({ version, name })),
      [{ version: 1, name: "first" }, { version: 2, name: "second" }],
    );
    assert.ok(recordedMigrations.every(({ applied_at }) => Number.isFinite(Date.parse(applied_at))));
  } finally {
    database.close();
  }
});

test("already applied migrations are skipped", () => {
  const database = createDatabase();

  try {
    runMigrations(database, [
      { version: 1, name: "first", sql: "CREATE TABLE should_not_be_created (id INTEGER)" },
      { version: 2, name: "second", sql: "CREATE TABLE second_migration (id INTEGER)" },
    ]);

    const appliedCount = database.prepare("SELECT COUNT(*) AS count FROM schema_version").get().count;
    assert.equal(appliedCount, 2);

    assert.doesNotThrow(() =>
      runMigrations(database, [
        { version: 1, name: "first", sql: "INSERT INTO schema_version VALUES (9, 'duplicate', 'now')" },
        { version: 2, name: "second", sql: "DROP TABLE second_migration" },
      ]),
    );
    assert.equal(getSchemaVersion(database), 2);
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM schema_version").get().count,
      appliedCount,
    );
    assert.equal(database.prepare("SELECT name FROM sqlite_master WHERE name = 'second_migration'").get().name,
      "second_migration");
  } finally {
    database.close();
  }
});

test("a failing migration rolls back its SQL and version record", () => {
  const database = createDatabase();

  try {
    assert.throws(
      () =>
        runMigrations(database, [
          {
            version: 1,
            name: "broken",
            sql: "CREATE TABLE rolled_back (id INTEGER); INSERT INTO missing_table VALUES (1)",
          },
        ]),
      /Failed to apply migration 1 \(broken\)/,
    );

    assert.equal(
      database.prepare("SELECT name FROM sqlite_master WHERE name = 'rolled_back'").get(),
      undefined,
    );
    assert.equal(getSchemaVersion(database), 0);
  } finally {
    database.close();
  }
});

test("a database newer than the known migrations is rejected", () => {
  const database = createDatabase();

  try {
    database
      .prepare("INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)")
      .run(3, "future", new Date().toISOString());

    assert.throws(
      () => runMigrations(database, [{ version: 2, name: "latest-known", sql: "SELECT 1" }]),
      /Database schema version 3 is newer than the newest known migration 2/,
    );
  } finally {
    database.close();
  }
});
