const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { test } = require("node:test");
const { ensureSchemaVersionTable, getSchemaVersion } = require("../src/main/db/schema");

test("schema_version table is created idempotently and reports the highest version", () => {
  const database = new DatabaseSync(":memory:");

  try {
    ensureSchemaVersionTable(database);
    ensureSchemaVersionTable(database);

    const columns = database.prepare("PRAGMA table_info(schema_version)").all();
    assert.deepEqual(columns.map(({ name, type, notnull }) => ({ name, type, notnull })), [
      { name: "version", type: "INTEGER", notnull: 1 },
      { name: "name", type: "TEXT", notnull: 1 },
      { name: "applied_at", type: "TEXT", notnull: 1 },
    ]);
    assert.equal(getSchemaVersion(database), 0);

    const insertVersion = database.prepare(
      "INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)",
    );
    insertVersion.run(1, "initial", "2026-10-04T00:00:00.000Z");
    insertVersion.run(3, "later", "2026-10-04T00:00:02.000Z");

    assert.equal(getSchemaVersion(database), 3);
  } finally {
    database.close();
  }
});
