const { listMuscles } = require("../db/muscles");
const { getSchemaVersion } = require("../db/schema");

function registerDbHandlers(ipcMain, getDatabase) {
  function requireDatabase() {
    const database = getDatabase();
    if (!database) throw new Error("Database is not open.");
    return database;
  }

  ipcMain.handle("db:schemaVersion", () => getSchemaVersion(requireDatabase()));
  ipcMain.handle("muscles:list", () => listMuscles(requireDatabase()));
}

module.exports = { registerDbHandlers };
