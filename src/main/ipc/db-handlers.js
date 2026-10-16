const { listMuscles } = require("../db/muscles");
const { getSchemaVersion } = require("../db/schema");
const { createWorkout, getWorkout, listWorkouts } = require("../db/workouts");

function registerDbHandlers(ipcMain, getDatabase) {
  function requireDatabase() {
    const database = getDatabase();
    if (!database) throw new Error("Database is not open.");
    return database;
  }

  ipcMain.handle("db:schemaVersion", () => getSchemaVersion(requireDatabase()));
  ipcMain.handle("muscles:list", () => listMuscles(requireDatabase()));

  // Only these fields reach the repository; the renderer can never set ids or timestamps.
  ipcMain.handle("workouts:create", (_event, payload) => {
    const { name, workout_date, notes } = typeof payload === "object" && payload !== null ? payload : {};
    return createWorkout(requireDatabase(), { name, workout_date, notes });
  });
  ipcMain.handle("workouts:get", (_event, id) => getWorkout(requireDatabase(), id));
  ipcMain.handle("workouts:list", () => listWorkouts(requireDatabase()));
}

module.exports = { registerDbHandlers };
