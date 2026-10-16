// Weights are always stored in kilograms; bodyweight sets use weight_kg 0.
module.exports = {
  version: 9,
  name: "set_log",
  sql: `
    CREATE TABLE set_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercise(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL CHECK (set_number >= 1),
      reps INTEGER NOT NULL CHECK (reps >= 0),
      weight_kg REAL NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
      created_at TEXT NOT NULL,
      UNIQUE (workout_exercise_id, set_number)
    )
  `,
};
