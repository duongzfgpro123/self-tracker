// One exercise slot inside a workout; the roadmap's "WorkoutSession" table (see docs/tasks/M4.md).
module.exports = {
  version: 8,
  name: "workout_exercise",
  sql: `
    CREATE TABLE workout_exercise (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL REFERENCES workout(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercise(id) ON DELETE RESTRICT,
      position INTEGER NOT NULL CHECK (position >= 1),
      notes TEXT,
      UNIQUE (workout_id, position)
    );
    CREATE INDEX workout_exercise_exercise_id_idx ON workout_exercise (exercise_id);
  `,
};
