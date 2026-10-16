const assert = require("node:assert/strict");
const { test } = require("node:test");
const { closeDatabase, openDatabase } = require("../src/main/db/connection");
const { runMigrations } = require("../src/main/db/migrate");
const migrations = require("../src/main/db/migrations");
const { ensureSchemaVersionTable } = require("../src/main/db/schema");

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
