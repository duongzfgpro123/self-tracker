function ensureSchemaVersionTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

function getSchemaVersion(database) {
  const result = database.prepare("SELECT MAX(version) AS version FROM schema_version").get();
  return result.version ?? 0;
}

module.exports = { ensureSchemaVersionTable, getSchemaVersion };
