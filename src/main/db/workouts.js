// Workout repository: workout -> workout_exercise -> set_log. Weights are kilograms.
const SET_TYPES = ["warmup", "working", "drop"];

function requireId(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function requireName(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Workout name is required.");
  }
  return value.trim();
}

function requireDate(value) {
  const match = typeof value === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return value;
    }
  }
  throw new Error("Workout date must be a real calendar date in YYYY-MM-DD format.");
}

function optionalNotes(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error("Notes must be text.");
  return value.trim() || null;
}

function requireInteger(value, label, min, max = Infinity) {
  if (!Number.isInteger(value) || value < min || value > max) {
    const range = max === Infinity ? `${min} or more` : `from ${min} to ${max}`;
    throw new Error(`${label} must be a whole number ${range}.`);
  }
  return value;
}

function optionalInteger(value, label, min, max) {
  return value === undefined || value === null ? null : requireInteger(value, label, min, max);
}

function requireWeight(value) {
  if (value === undefined) return 0;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Weight must be a number of 0 kg or more.");
  }
  return value;
}

function optionalRpe(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || value < 1 || value > 10 || !Number.isInteger(value * 2)) {
    throw new Error("RPE must be from 1 to 10 in half steps.");
  }
  return value;
}

function requireSetType(value) {
  if (value === undefined) return "working";
  if (!SET_TYPES.includes(value)) {
    throw new Error(`Set type must be one of: ${SET_TYPES.join(", ")}.`);
  }
  return value;
}

function inTransaction(database, work) {
  if (database.isTransaction) return work();

  database.exec("BEGIN");
  try {
    const result = work();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function touchWorkout(database, workoutId, now) {
  database.prepare("UPDATE workout SET updated_at = ? WHERE id = ?").run(now, workoutId);
}

function createWorkout(database, { name, workout_date, notes } = {}, now = new Date().toISOString()) {
  const values = [requireName(name), requireDate(workout_date), optionalNotes(notes), now, now];
  const { lastInsertRowid } = database
    .prepare("INSERT INTO workout (name, workout_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(...values);
  return getWorkout(database, Number(lastInsertRowid));
}

function addExerciseToWorkout(database, workoutId, exerciseId, notes, now = new Date().toISOString()) {
  requireId(workoutId, "Workout id");
  requireId(exerciseId, "Exercise id");
  const cleanNotes = optionalNotes(notes);

  return inTransaction(database, () => {
    if (!database.prepare("SELECT 1 FROM workout WHERE id = ?").get(workoutId)) {
      throw new Error(`Workout ${workoutId} does not exist.`);
    }
    if (!database.prepare("SELECT 1 FROM exercise WHERE id = ?").get(exerciseId)) {
      throw new Error(`Exercise ${exerciseId} does not exist.`);
    }

    const { position } = database
      .prepare("SELECT COALESCE(MAX(position), 0) + 1 AS position FROM workout_exercise WHERE workout_id = ?")
      .get(workoutId);
    const { lastInsertRowid } = database
      .prepare("INSERT INTO workout_exercise (workout_id, exercise_id, position, notes) VALUES (?, ?, ?, ?)")
      .run(workoutId, exerciseId, position, cleanNotes);
    touchWorkout(database, workoutId, now);

    return {
      id: Number(lastInsertRowid),
      workout_id: workoutId,
      exercise_id: exerciseId,
      position,
      notes: cleanNotes,
    };
  });
}

function addSet(database, workoutExerciseId, set = {}, now = new Date().toISOString()) {
  requireId(workoutExerciseId, "Workout exercise id");
  const values = {
    reps: requireInteger(set.reps, "Reps", 0),
    weight_kg: requireWeight(set.weight_kg),
    rpe: optionalRpe(set.rpe),
    rir: optionalInteger(set.rir, "RIR", 0, 10),
    rest_seconds: optionalInteger(set.rest_seconds, "Rest time in seconds", 0),
    set_type: requireSetType(set.set_type),
  };

  return inTransaction(database, () => {
    const slot = database.prepare("SELECT workout_id FROM workout_exercise WHERE id = ?").get(workoutExerciseId);
    if (!slot) throw new Error(`Workout exercise ${workoutExerciseId} does not exist.`);

    const { set_number } = database
      .prepare("SELECT COALESCE(MAX(set_number), 0) + 1 AS set_number FROM set_log WHERE workout_exercise_id = ?")
      .get(workoutExerciseId);
    const { lastInsertRowid } = database
      .prepare(
        `INSERT INTO set_log
          (workout_exercise_id, set_number, reps, weight_kg, rpe, rir, rest_seconds, set_type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        workoutExerciseId,
        set_number,
        values.reps,
        values.weight_kg,
        values.rpe,
        values.rir,
        values.rest_seconds,
        values.set_type,
        now,
      );
    touchWorkout(database, slot.workout_id, now);

    return { id: Number(lastInsertRowid), workout_exercise_id: workoutExerciseId, set_number, ...values, created_at: now };
  });
}

function getWorkout(database, id) {
  requireId(id, "Workout id");
  const workout = database
    .prepare(
      `SELECT id, name, workout_date, started_at, ended_at, duration_seconds, notes, created_at, updated_at
        FROM workout WHERE id = ?`,
    )
    .get(id);
  if (!workout) return null;

  const sets = database
    .prepare(
      `SELECT s.id, s.workout_exercise_id, s.set_number, s.reps, s.weight_kg, s.rpe, s.rir, s.rest_seconds,
          s.set_type, s.created_at
        FROM set_log s JOIN workout_exercise we ON we.id = s.workout_exercise_id
        WHERE we.workout_id = ?
        ORDER BY s.set_number`,
    )
    .all(id);
  const exercises = database
    .prepare(
      `SELECT we.id, we.exercise_id, e.name AS exercise_name, we.position, we.notes
        FROM workout_exercise we JOIN exercise e ON e.id = we.exercise_id
        WHERE we.workout_id = ?
        ORDER BY we.position`,
    )
    .all(id)
    .map((exercise) => ({
      ...exercise,
      sets: sets.filter((set) => set.workout_exercise_id === exercise.id).map((set) => ({ ...set })),
    }));

  return { ...workout, exercises };
}

function listWorkouts(database) {
  return database
    .prepare(
      `SELECT w.id, w.name, w.workout_date, w.duration_seconds,
          (SELECT COUNT(*) FROM workout_exercise we WHERE we.workout_id = w.id) AS exercise_count,
          (SELECT COUNT(*) FROM set_log s JOIN workout_exercise we ON we.id = s.workout_exercise_id
            WHERE we.workout_id = w.id) AS set_count
        FROM workout w
        ORDER BY w.workout_date DESC, w.id DESC`,
    )
    .all()
    .map((workout) => ({ ...workout }));
}

module.exports = { SET_TYPES, addExerciseToWorkout, addSet, createWorkout, getWorkout, listWorkouts };
