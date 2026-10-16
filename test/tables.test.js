const assert = require("node:assert/strict");
const { test } = require("node:test");
const { closeDatabase, openDatabase } = require("../src/main/db/connection");
const { runMigrations } = require("../src/main/db/migrate");
const migrations = require("../src/main/db/migrations");
const { ensureSchemaVersionTable } = require("../src/main/db/schema");
const { validateExerciseImport } = require("../src/main/db/exercise-format");

const NOW = "2026-10-16T00:00:00.000Z";

function createMigratedDatabase() {
  const database = openDatabase(":memory:");
  ensureSchemaVersionTable(database);
  runMigrations(database, migrations);
  return database;
}

test("user_profile allows only id 1 and known units", () => {
  const database = createMigratedDatabase();

  try {
    const insertProfile = database.prepare(
      "INSERT INTO user_profile (id, display_name, units, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    );
    insertProfile.run(1, "Tester", "lb", NOW, NOW);
    assert.equal(database.prepare("SELECT units FROM user_profile WHERE id = 1").get().units, "lb");

    assert.throws(() => insertProfile.run(2, "Second", "kg", NOW, NOW), /CHECK constraint failed/);
    database.exec("DELETE FROM user_profile");
    assert.throws(() => insertProfile.run(1, "Tester", "stone", NOW, NOW), /CHECK constraint failed/);

    database
      .prepare("INSERT INTO user_profile (id, created_at, updated_at) VALUES (1, ?, ?)")
      .run(NOW, NOW);
    assert.equal(database.prepare("SELECT units FROM user_profile WHERE id = 1").get().units, "kg");
  } finally {
    closeDatabase(database);
  }
});

test("goal rejects unknown types and allows a null target weight", () => {
  const database = createMigratedDatabase();

  try {
    const insertGoal = database.prepare(
      "INSERT INTO goal (type, target_weight_kg, start_date, created_at) VALUES (?, ?, ?, ?)",
    );
    const { lastInsertRowid } = insertGoal.run("general_health", null, "2026-10-16", NOW);
    const goal = database.prepare("SELECT target_weight_kg, is_active FROM goal WHERE id = ?").get(lastInsertRowid);
    assert.equal(goal.target_weight_kg, null);
    assert.equal(goal.is_active, 1);

    assert.throws(() => insertGoal.run("bulking", 80, "2026-10-16", NOW), /CHECK constraint failed/);
  } finally {
    closeDatabase(database);
  }
});

test("muscle rejects duplicate names and unknown groups", () => {
  const database = createMigratedDatabase();

  try {
    const insertMuscle = database.prepare("INSERT INTO muscle (name, group_name) VALUES (?, ?)");
    insertMuscle.run("Test muscle", "Chest");

    assert.throws(() => insertMuscle.run("Test muscle", "Back"), /UNIQUE constraint failed/);
    assert.throws(() => insertMuscle.run("Another muscle", "Neck"), /CHECK constraint failed/);
  } finally {
    closeDatabase(database);
  }
});

test("exercise rejects unknown difficulty and duplicate names", () => {
  const database = createMigratedDatabase();

  try {
    const insertExercise = database.prepare(
      "INSERT INTO exercise (name, difficulty, created_at) VALUES (?, ?, ?)",
    );
    const { lastInsertRowid } = insertExercise.run("Test exercise", "beginner", NOW);
    assert.equal(
      database.prepare("SELECT is_custom FROM exercise WHERE id = ?").get(lastInsertRowid).is_custom,
      0,
    );

    assert.throws(() => insertExercise.run("Other exercise", "expert", NOW), /CHECK constraint failed/);
    assert.throws(() => insertExercise.run("Test exercise", "advanced", NOW), /UNIQUE constraint failed/);
  } finally {
    closeDatabase(database);
  }
});

test("exercise_muscle enforces links, cascades exercise deletes, and protects used muscles", () => {
  const database = createMigratedDatabase();

  try {
    const exerciseId = database
      .prepare("INSERT INTO exercise (name, created_at) VALUES (?, ?)")
      .run("Test exercise", NOW).lastInsertRowid;
    const muscleId = database
      .prepare("INSERT INTO muscle (name, group_name) VALUES (?, ?)")
      .run("Test muscle", "Legs").lastInsertRowid;
    const insertLink = database.prepare(
      "INSERT INTO exercise_muscle (exercise_id, muscle_id, role) VALUES (?, ?, ?)",
    );
    const countLinks = () => database.prepare("SELECT COUNT(*) AS count FROM exercise_muscle").get().count;

    assert.throws(() => insertLink.run(exerciseId, 9999, "primary"), /FOREIGN KEY constraint failed/);
    assert.throws(() => insertLink.run(9999, muscleId, "primary"), /FOREIGN KEY constraint failed/);
    assert.throws(() => insertLink.run(exerciseId, muscleId, "helper"), /CHECK constraint failed/);

    insertLink.run(exerciseId, muscleId, "primary");
    assert.throws(
      () => database.prepare("DELETE FROM muscle WHERE id = ?").run(muscleId),
      /FOREIGN KEY constraint failed/,
    );
    assert.equal(countLinks(), 1);

    database.prepare("DELETE FROM exercise WHERE id = ?").run(exerciseId);
    assert.equal(countLinks(), 0);

    const indexedColumns = database
      .prepare("PRAGMA index_info(exercise_muscle_muscle_id_idx)")
      .all()
      .map(({ name }) => name);
    assert.deepEqual(indexedColumns, ["muscle_id"]);
  } finally {
    closeDatabase(database);
  }
});

test("muscle seed inserts exactly 21 muscles and is safe to re-run", () => {
  const database = createMigratedDatabase();
  const seedMigration = migrations.find(({ name }) => name === "seed_muscles");
  const countByGroup = () =>
    Object.fromEntries(
      database
        .prepare("SELECT group_name, COUNT(*) AS count FROM muscle GROUP BY group_name")
        .all()
        .map(({ group_name, count }) => [group_name, count]),
    );
  const expectedCounts = { Arms: 4, Back: 4, Chest: 1, Core: 2, Legs: 7, Shoulders: 3 };

  try {
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM muscle").get().count, 21);
    assert.deepEqual(countByGroup(), expectedCounts);
    assert.equal(
      database.prepare("SELECT group_name FROM muscle WHERE name = 'Gluteus medius'").get().group_name,
      "Legs",
    );

    database.exec(seedMigration.sql);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM muscle").get().count, 21);
    assert.deepEqual(countByGroup(), expectedCounts);
  } finally {
    closeDatabase(database);
  }
});

test("workout rejects blank names, malformed dates, and negative durations", () => {
  const database = createMigratedDatabase();

  try {
    const insertWorkout = database.prepare(
      "INSERT INTO workout (name, workout_date, duration_seconds, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    );
    const { lastInsertRowid } = insertWorkout.run("Push day", "2026-10-16", 3600, NOW, NOW);
    assert.equal(
      database.prepare("SELECT workout_date FROM workout WHERE id = ?").get(lastInsertRowid).workout_date,
      "2026-10-16",
    );
    insertWorkout.run("No duration yet", "2026-10-17", null, NOW, NOW);

    assert.throws(() => insertWorkout.run("   ", "2026-10-16", null, NOW, NOW), /CHECK constraint failed/);
    assert.throws(() => insertWorkout.run("Push day", "16/10/2026", null, NOW, NOW), /CHECK constraint failed/);
    assert.throws(() => insertWorkout.run("Push day", "2026-10-16", -1, NOW, NOW), /CHECK constraint failed/);

    const indexedColumns = database
      .prepare("PRAGMA index_info(workout_workout_date_idx)")
      .all()
      .map(({ name }) => name);
    assert.deepEqual(indexedColumns, ["workout_date"]);
  } finally {
    closeDatabase(database);
  }
});

test("workout_exercise enforces links and positions, cascades workout deletes, and protects used exercises", () => {
  const database = createMigratedDatabase();

  try {
    const workoutId = database
      .prepare("INSERT INTO workout (name, workout_date, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run("Push day", "2026-10-16", NOW, NOW).lastInsertRowid;
    const exerciseId = database
      .prepare("INSERT INTO exercise (name, created_at) VALUES (?, ?)")
      .run("Test exercise", NOW).lastInsertRowid;
    const insertSlot = database.prepare(
      "INSERT INTO workout_exercise (workout_id, exercise_id, position) VALUES (?, ?, ?)",
    );
    const countSlots = () => database.prepare("SELECT COUNT(*) AS count FROM workout_exercise").get().count;

    assert.throws(() => insertSlot.run(9999, exerciseId, 1), /FOREIGN KEY constraint failed/);
    assert.throws(() => insertSlot.run(workoutId, 9999, 1), /FOREIGN KEY constraint failed/);
    assert.throws(() => insertSlot.run(workoutId, exerciseId, 0), /CHECK constraint failed/);

    insertSlot.run(workoutId, exerciseId, 1);
    assert.throws(() => insertSlot.run(workoutId, exerciseId, 1), /UNIQUE constraint failed/);
    insertSlot.run(workoutId, exerciseId, 2);

    assert.throws(
      () => database.prepare("DELETE FROM exercise WHERE id = ?").run(exerciseId),
      /FOREIGN KEY constraint failed/,
    );
    assert.equal(countSlots(), 2);

    database.prepare("DELETE FROM workout WHERE id = ?").run(workoutId);
    assert.equal(countSlots(), 0);

    const indexedColumns = database
      .prepare("PRAGMA index_info(workout_exercise_exercise_id_idx)")
      .all()
      .map(({ name }) => name);
    assert.deepEqual(indexedColumns, ["exercise_id"]);
  } finally {
    closeDatabase(database);
  }
});

function insertWorkoutSlot(database) {
  const workoutId = database
    .prepare("INSERT INTO workout (name, workout_date, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run("Push day", "2026-10-16", NOW, NOW).lastInsertRowid;
  const exerciseId = database
    .prepare("INSERT INTO exercise (name, created_at) VALUES (?, ?)")
    .run("Test exercise", NOW).lastInsertRowid;
  const workoutExerciseId = database
    .prepare("INSERT INTO workout_exercise (workout_id, exercise_id, position) VALUES (?, ?, 1)")
    .run(workoutId, exerciseId).lastInsertRowid;
  return { workoutId, workoutExerciseId };
}

test("set_log rejects negative reps and weight and duplicate set numbers, and follows workout deletes", () => {
  const database = createMigratedDatabase();

  try {
    const { workoutId, workoutExerciseId } = insertWorkoutSlot(database);
    const insertSet = database.prepare(
      "INSERT INTO set_log (workout_exercise_id, set_number, reps, weight_kg, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    const countSets = () => database.prepare("SELECT COUNT(*) AS count FROM set_log").get().count;

    insertSet.run(workoutExerciseId, 1, 8, 60, NOW);
    const bodyweightId = database
      .prepare("INSERT INTO set_log (workout_exercise_id, set_number, reps, created_at) VALUES (?, 2, 12, ?)")
      .run(workoutExerciseId, NOW).lastInsertRowid;
    assert.equal(database.prepare("SELECT weight_kg FROM set_log WHERE id = ?").get(bodyweightId).weight_kg, 0);

    assert.throws(() => insertSet.run(workoutExerciseId, 3, -1, 60, NOW), /CHECK constraint failed/);
    assert.throws(() => insertSet.run(workoutExerciseId, 3, 8, -2.5, NOW), /CHECK constraint failed/);
    assert.throws(() => insertSet.run(workoutExerciseId, 0, 8, 60, NOW), /CHECK constraint failed/);
    assert.throws(() => insertSet.run(workoutExerciseId, 1, 8, 60, NOW), /UNIQUE constraint failed/);
    assert.throws(() => insertSet.run(9999, 3, 8, 60, NOW), /FOREIGN KEY constraint failed/);
    assert.equal(countSets(), 2);

    database.prepare("DELETE FROM workout WHERE id = ?").run(workoutId);
    assert.equal(countSets(), 0);
  } finally {
    closeDatabase(database);
  }
});

test("set_log rpe accepts half steps from 1 to 10 or null", () => {
  const database = createMigratedDatabase();

  try {
    const { workoutExerciseId } = insertWorkoutSlot(database);
    const insertSet = database.prepare(
      "INSERT INTO set_log (workout_exercise_id, set_number, reps, rpe, created_at) VALUES (?, ?, 8, ?, ?)",
    );

    insertSet.run(workoutExerciseId, 1, 8.5, NOW);
    insertSet.run(workoutExerciseId, 2, null, NOW);
    insertSet.run(workoutExerciseId, 3, 10, NOW);
    assert.deepEqual(
      database.prepare("SELECT rpe FROM set_log ORDER BY set_number").all().map(({ rpe }) => rpe),
      [8.5, null, 10],
    );

    for (const badRpe of [0, 11, 7.3]) {
      assert.throws(() => insertSet.run(workoutExerciseId, 4, badRpe, NOW), /CHECK constraint failed/);
    }
  } finally {
    closeDatabase(database);
  }
});

test("set_log rir accepts 0 to 10 or null", () => {
  const database = createMigratedDatabase();

  try {
    const { workoutExerciseId } = insertWorkoutSlot(database);
    const insertSet = database.prepare(
      "INSERT INTO set_log (workout_exercise_id, set_number, reps, rir, created_at) VALUES (?, ?, 8, ?, ?)",
    );

    insertSet.run(workoutExerciseId, 1, 0, NOW);
    insertSet.run(workoutExerciseId, 2, null, NOW);
    assert.deepEqual(
      database.prepare("SELECT rir FROM set_log ORDER BY set_number").all().map(({ rir }) => rir),
      [0, null],
    );

    assert.throws(() => insertSet.run(workoutExerciseId, 3, -1, NOW), /CHECK constraint failed/);
    assert.throws(() => insertSet.run(workoutExerciseId, 3, 11, NOW), /CHECK constraint failed/);
  } finally {
    closeDatabase(database);
  }
});

test("set_log rest_seconds accepts zero or more or null", () => {
  const database = createMigratedDatabase();

  try {
    const { workoutExerciseId } = insertWorkoutSlot(database);
    const insertSet = database.prepare(
      "INSERT INTO set_log (workout_exercise_id, set_number, reps, rest_seconds, created_at) VALUES (?, ?, 8, ?, ?)",
    );

    insertSet.run(workoutExerciseId, 1, 90, NOW);
    insertSet.run(workoutExerciseId, 2, null, NOW);
    assert.deepEqual(
      database.prepare("SELECT rest_seconds FROM set_log ORDER BY set_number").all().map((row) => row.rest_seconds),
      [90, null],
    );

    assert.throws(() => insertSet.run(workoutExerciseId, 3, -5, NOW), /CHECK constraint failed/);
  } finally {
    closeDatabase(database);
  }
});

test("set_log set_type defaults to working, also for rows that existed before the column", () => {
  const database = openDatabase(":memory:");
  const typeMigration = migrations.find(({ name }) => name === "set_log_type");

  try {
    ensureSchemaVersionTable(database);
    runMigrations(
      database,
      migrations.filter(({ version }) => version < typeMigration.version),
    );
    const { workoutExerciseId } = insertWorkoutSlot(database);
    database
      .prepare("INSERT INTO set_log (workout_exercise_id, set_number, reps, created_at) VALUES (?, 1, 8, ?)")
      .run(workoutExerciseId, NOW);

    runMigrations(database, migrations);
    assert.equal(database.prepare("SELECT set_type FROM set_log WHERE set_number = 1").get().set_type, "working");

    const insertSet = database.prepare(
      "INSERT INTO set_log (workout_exercise_id, set_number, reps, set_type, created_at) VALUES (?, ?, 8, ?, ?)",
    );
    insertSet.run(workoutExerciseId, 2, "warmup", NOW);
    insertSet.run(workoutExerciseId, 3, "drop", NOW);
    database
      .prepare("INSERT INTO set_log (workout_exercise_id, set_number, reps, created_at) VALUES (?, 4, 8, ?)")
      .run(workoutExerciseId, NOW);
    assert.deepEqual(
      database.prepare("SELECT set_type FROM set_log ORDER BY set_number").all().map(({ set_type }) => set_type),
      ["working", "warmup", "drop", "working"],
    );

    assert.throws(() => insertSet.run(workoutExerciseId, 5, "failure", NOW), /CHECK constraint failed/);
  } finally {
    closeDatabase(database);
  }
});

test("exercise seed inserts 30 valid built-in exercises and is safe to re-run", () => {
  const database = createMigratedDatabase();
  const seedMigration = migrations.find(({ name }) => name === "seed_exercises");
  const countExercises = () => database.prepare("SELECT COUNT(*) AS count FROM exercise").get().count;

  try {
    assert.equal(countExercises(), 30);
    assert.equal(validateExerciseImport(seedMigration.seedFile).length, 30);

    const rows = database
      .prepare("SELECT name, movement_pattern, equipment, difficulty, instructions, common_mistakes, is_custom, created_at FROM exercise")
      .all();
    assert.ok(rows.every(({ is_custom }) => is_custom === 0));
    assert.ok(rows.every(({ instructions, common_mistakes }) => instructions === null && common_mistakes === null));
    assert.ok(rows.every(({ created_at }) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(created_at)));
    const { created_at, ...carry } = rows.find(({ name }) => name === "Farmer's carry");
    assert.deepEqual(carry, {
      name: "Farmer's carry",
      movement_pattern: "carry",
      equipment: "dumbbell",
      difficulty: "beginner",
      instructions: null,
      common_mistakes: null,
      is_custom: 0,
    });
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM exercise_muscle").get().count, 0);

    database.exec(seedMigration.sql);
    assert.equal(countExercises(), 30);
  } finally {
    closeDatabase(database);
  }
});
