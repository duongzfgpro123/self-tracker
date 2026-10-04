const { DatabaseSync } = require("node:sqlite");

function getSqliteVersion() {
  const database = new DatabaseSync(":memory:");

  try {
    return database.prepare("SELECT sqlite_version() AS version").get().version;
  } finally {
    database.close();
  }
}

module.exports = { getSqliteVersion };
