const { DatabaseSync } = require("node:sqlite");

const closedDatabases = new WeakSet();

function openDatabase(location) {
  const database = new DatabaseSync(location);

  try {
    database.exec("PRAGMA foreign_keys = ON");
    database.exec("PRAGMA busy_timeout = 5000");
    return database;
  } catch (error) {
    try {
      database.close();
    } catch {}
    throw error;
  }
}

function closeDatabase(database) {
  if (closedDatabases.has(database)) return;

  database.close();
  closedDatabases.add(database);
}

module.exports = { openDatabase, closeDatabase };
