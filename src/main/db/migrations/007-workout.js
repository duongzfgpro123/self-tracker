module.exports = {
  version: 7,
  name: "workout",
  sql: `
    CREATE TABLE workout (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      workout_date TEXT NOT NULL CHECK (workout_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      started_at TEXT,
      ended_at TEXT,
      duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX workout_workout_date_idx ON workout (workout_date);
  `,
};
