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
