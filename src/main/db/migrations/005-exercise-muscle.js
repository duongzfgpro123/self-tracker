module.exports = {
  version: 5,
  name: "exercise_muscle",
  sql: `
    CREATE TABLE exercise_muscle (
      exercise_id INTEGER NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
      muscle_id INTEGER NOT NULL REFERENCES muscle(id) ON DELETE RESTRICT,
      role TEXT NOT NULL CHECK (role IN ('primary', 'secondary', 'stabiliser')),
      PRIMARY KEY (exercise_id, muscle_id)
    );
    CREATE INDEX exercise_muscle_muscle_id_idx ON exercise_muscle (muscle_id);
  `,
};
