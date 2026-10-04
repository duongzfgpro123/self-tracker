const assert = require("node:assert/strict");
const { test } = require("node:test");
const { closeDatabase, openDatabase } = require("../src/main/db/connection");

test("database connection enables foreign keys and closes safely twice", () => {
  const database = openDatabase(":memory:");

  try {
    assert.equal(database.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    assert.equal(database.prepare("PRAGMA busy_timeout").get().timeout, 5000);
  } finally {
    closeDatabase(database);
  }

  assert.doesNotThrow(() => closeDatabase(database));
});
