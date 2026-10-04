const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getSqliteVersion } = require("../src/main/db/probe");

test("built-in SQLite returns a version string", () => {
  const version = getSqliteVersion();

  assert.equal(typeof version, "string");
  assert.ok(version.trim().length > 0);
});
