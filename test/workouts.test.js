const assert = require("node:assert/strict");
const { test } = require("node:test");
const { closeDatabase, openDatabase } = require("../src/main/db/connection");
const { runMigrations } = require("../src/main/db/migrate");
const migrations = require("../src/main/db/migrations");
const { ensureSchemaVersionTable } = require("../src/main/db/schema");
const {
  addExerciseToWorkout,
  addSet,
  createWorkout,
  getWorkout,
  listWorkouts,
} = require("../src/main/db/workouts");

const NOW = "2026-10-16T00:00:00.000Z";
const LATER = "2026-10-16T01:00:00.000Z";

function withDatabase(run) {
  const database = openDatabase(":memory:");
  try {
    ensureSchemaVersionTable(database);
    runMigrations(database, migrations);
    run(database);
  } finally {
    closeDatabase(database);
  }
}

function insertExercise(database, name) {
  return Number(
    database.prepare("INSERT INTO exercise (name, created_at) VALUES (?, ?)").run(name, NOW).lastInsertRowid,
  );
}

test("createWorkout stores a trimmed workout and returns it with no exercises", () => {
  withDatabase((database) => {
    const workout = createWorkout(database, { name: "  Push day ", workout_date: "2026-10-16", notes: "  " }, NOW);

    assert.deepEqual(workout, {
      id: workout.id,
      name: "Push day",
      workout_date: "2026-10-16",
      started_at: null,
      ended_at: null,
      duration_seconds: null,
      notes: null,
      created_at: NOW,
      updated_at: NOW,
      exercises: [],
    });
    assert.deepEqual(getWorkout(database, workout.id), workout);
  });
});

test("getWorkout returns exercises by position and sets by set number", () => {
  withDatabase((database) => {
    const bench = insertExercise(database, "Test bench press");
    const dip = insertExercise(database, "Test dip");
    const { id: workoutId } = createWorkout(database, { name: "Push day", workout_date: "2026-10-16" }, NOW);

    const benchSlot = addExerciseToWorkout(database, workoutId, bench, "Pause reps", NOW);
    const dipSlot = addExerciseToWorkout(database, workoutId, dip, undefined, NOW);
    assert.equal(benchSlot.position, 1);
    assert.equal(dipSlot.position, 2);

    addSet(database, benchSlot.id, { reps: 10, weight_kg: 40, set_type: "warmup" }, NOW);
    const working = addSet(database, benchSlot.id, { reps: 8, weight_kg: 60, rpe: 8.5, rir: 2, rest_seconds: 120 }, NOW);
    addSet(database, dipSlot.id, { reps: 12 }, LATER);

    assert.equal(working.set_number, 2);
    assert.equal(working.set_type, "working");

    const workout = getWorkout(database, workoutId);
    assert.equal(workout.updated_at, LATER);
    assert.deepEqual(
      workout.exercises.map(({ exercise_name, position, notes }) => ({ exercise_name, position, notes })),
      [
        { exercise_name: "Test bench press", position: 1, notes: "Pause reps" },
        { exercise_name: "Test dip", position: 2, notes: null },
      ],
    );
    assert.deepEqual(
      workout.exercises[0].sets.map(({ set_number, reps, weight_kg, set_type }) => [set_number, reps, weight_kg, set_type]),
      [
        [1, 10, 40, "warmup"],
        [2, 8, 60, "working"],
      ],
    );
    assert.deepEqual(workout.exercises[0].sets[1], {
      id: working.id,
      workout_exercise_id: benchSlot.id,
      set_number: 2,
      reps: 8,
      weight_kg: 60,
      rpe: 8.5,
      rir: 2,
      rest_seconds: 120,
      set_type: "working",
      created_at: NOW,
    });
    assert.deepEqual(workout.exercises[1].sets.map(({ reps, weight_kg, rpe }) => [reps, weight_kg, rpe]), [[12, 0, null]]);
  });
});

test("listWorkouts orders newest date first and counts exercises and sets", () => {
  withDatabase((database) => {
    const squat = insertExercise(database, "Test squat");
    const older = createWorkout(database, { name: "Legs", workout_date: "2026-10-14" }, NOW);
    const newer = createWorkout(database, { name: "Push", workout_date: "2026-10-16" }, NOW);
    const sameDay = createWorkout(database, { name: "Evening", workout_date: "2026-10-16" }, NOW);

    const slot = addExerciseToWorkout(database, older.id, squat, null, NOW);
    addSet(database, slot.id, { reps: 5, weight_kg: 100 }, NOW);
    addSet(database, slot.id, { reps: 5, weight_kg: 100 }, NOW);

    assert.deepEqual(listWorkouts(database), [
      { id: sameDay.id, name: "Evening", workout_date: "2026-10-16", duration_seconds: null, exercise_count: 0, set_count: 0 },
      { id: newer.id, name: "Push", workout_date: "2026-10-16", duration_seconds: null, exercise_count: 0, set_count: 0 },
      { id: older.id, name: "Legs", workout_date: "2026-10-14", duration_seconds: null, exercise_count: 1, set_count: 2 },
    ]);
  });
});

test("workout repository rejects invalid input with clear messages before writing", () => {
  withDatabase((database) => {
    const exerciseId = insertExercise(database, "Test bench press");
    const { id: workoutId } = createWorkout(database, { name: "Push", workout_date: "2026-10-16" }, NOW);
    const slot = addExerciseToWorkout(database, workoutId, exerciseId, null, NOW);

    assert.throws(() => createWorkout(database, { name: "  ", workout_date: "2026-10-16" }), /Workout name is required/);
    assert.throws(() => createWorkout(database, { workout_date: "2026-10-16" }), /Workout name is required/);
    for (const badDate of ["2026-02-30", "16/10/2026", "2026-1-5", undefined]) {
      assert.throws(() => createWorkout(database, { name: "Push", workout_date: badDate }), /real calendar date/);
    }
    assert.throws(() => createWorkout(database, { name: "Push", workout_date: "2026-10-16", notes: 5 }), /Notes must be text/);

    assert.throws(() => addExerciseToWorkout(database, "1", exerciseId), /Workout id must be a positive integer/);
    assert.throws(() => addExerciseToWorkout(database, workoutId, 0), /Exercise id must be a positive integer/);

    assert.throws(() => addSet(database, slot.id, {}), /Reps must be a whole number 0 or more/);
    assert.throws(() => addSet(database, slot.id, { reps: 2.5 }), /Reps must be a whole number/);
    assert.throws(() => addSet(database, slot.id, { reps: 5, weight_kg: -1 }), /Weight must be a number of 0 kg or more/);
    assert.throws(() => addSet(database, slot.id, { reps: 5, rpe: 7.3 }), /RPE must be from 1 to 10 in half steps/);
    assert.throws(() => addSet(database, slot.id, { reps: 5, rir: 11 }), /RIR must be a whole number from 0 to 10/);
    assert.throws(() => addSet(database, slot.id, { reps: 5, rest_seconds: -5 }), /Rest time in seconds must be/);
    assert.throws(() => addSet(database, slot.id, { reps: 5, set_type: "failure" }), /Set type must be one of/);

    assert.equal(listWorkouts(database).length, 1);
    assert.deepEqual(getWorkout(database, workoutId).exercises[0].sets, []);
  });
});

test("workout repository reports missing ids and leaves no partial rows", () => {
  withDatabase((database) => {
    const exerciseId = insertExercise(database, "Test bench press");
    const { id: workoutId } = createWorkout(database, { name: "Push", workout_date: "2026-10-16" }, NOW);

    assert.equal(getWorkout(database, 9999), null);
    assert.throws(() => addExerciseToWorkout(database, 9999, exerciseId), /Workout 9999 does not exist/);
    assert.throws(() => addExerciseToWorkout(database, workoutId, 9999), /Exercise 9999 does not exist/);
    assert.throws(() => addSet(database, 9999, { reps: 5 }), /Workout exercise 9999 does not exist/);

    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM workout_exercise").get().count, 0);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM set_log").get().count, 0);
    assert.equal(database.isTransaction, false);
    assert.equal(getWorkout(database, workoutId).updated_at, NOW);
  });
});
