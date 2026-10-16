const assert = require("node:assert/strict");
const { test } = require("node:test");
const { validateExerciseImport } = require("../src/main/db/exercise-format");

function validFile(overrides = {}) {
  return {
    format: "self-tracker-exercises",
    version: 1,
    exercises: [
      {
        name: "  Back squat ",
        movement_pattern: "squat",
        equipment: "barbell",
        difficulty: "intermediate",
        instructions: null,
        common_mistakes: "  ",
        muscles: [{ name: "Quadriceps", role: "primary" }],
      },
      { name: "Plank", movement_pattern: "core", equipment: "bodyweight", difficulty: "beginner" },
    ],
    ...overrides,
  };
}

function withExercise(changes) {
  const file = validFile();
  file.exercises[0] = { ...file.exercises[0], ...changes };
  return file;
}

test("a valid import returns normalised exercises", () => {
  assert.deepEqual(validateExerciseImport(validFile(), { muscleNames: ["Quadriceps"] }), [
    {
      name: "Back squat",
      movement_pattern: "squat",
      equipment: "barbell",
      difficulty: "intermediate",
      instructions: null,
      common_mistakes: null,
      muscles: [{ name: "Quadriceps", role: "primary" }],
    },
    {
      name: "Plank",
      movement_pattern: "core",
      equipment: "bodyweight",
      difficulty: "beginner",
      instructions: null,
      common_mistakes: null,
      muscles: [],
    },
  ]);
});

test("file-level rules are enforced", () => {
  assert.throws(() => validateExerciseImport([]), /file must be a JSON object/);
  assert.throws(() => validateExerciseImport(validFile({ format: "other" })), /format must be "self-tracker-exercises"/);
  assert.throws(() => validateExerciseImport(validFile({ version: 2 })), /version must be 1/);
  assert.throws(() => validateExerciseImport(validFile({ exercises: [] })), /exercises must be a non-empty array/);
  assert.throws(() => validateExerciseImport(validFile({ extra: true })), /file has unknown key "extra"/);
  assert.throws(() => validateExerciseImport(validFile({ exercises: ["Squat"] })), /exercises\[0\] must be an object/);
});

test("exercise fields are validated with their path", () => {
  const cases = [
    [{ name: " " }, /exercises\[0\]\.name is required text/],
    [{ name: "plank" }, /exercises\[1\]\.name "Plank" is a duplicate/],
    [{ movement_pattern: "push" }, /exercises\[0\]\.movement_pattern must be one of: horizontal_push/],
    [{ equipment: "smith" }, /exercises\[0\]\.equipment must be one of: barbell/],
    [{ difficulty: "expert" }, /exercises\[0\]\.difficulty must be one of: beginner, intermediate, advanced/],
    [{ instructions: 5 }, /exercises\[0\]\.instructions must be text or null/],
    [{ sources: [] }, /exercises\[0\] has unknown key "sources"/],
  ];

  for (const [changes, message] of cases) {
    assert.throws(() => validateExerciseImport(withExercise(changes)), message);
  }
});

test("muscle links are validated", () => {
  const cases = [
    [{ muscles: "Quadriceps" }, /exercises\[0\]\.muscles must be an array/],
    [{ muscles: [{ name: "Quadriceps", role: "helper" }] }, /muscles\[0\]\.role must be one of: primary, secondary, stabiliser/],
    [
      { muscles: [{ name: "Quadriceps", role: "primary" }, { name: "Quadriceps", role: "secondary" }] },
      /muscles\[1\]\.name "Quadriceps" is listed twice/,
    ],
    [{ muscles: [{ name: "Quadriceps", role: "primary", side: "left" }] }, /muscles\[0\] has unknown key "side"/],
  ];

  for (const [changes, message] of cases) {
    assert.throws(() => validateExerciseImport(withExercise(changes)), message);
  }

  assert.throws(
    () => validateExerciseImport(validFile(), { muscleNames: ["Hamstrings"] }),
    /muscles\[0\]\.name "Quadriceps" is not a known muscle/,
  );
  assert.equal(validateExerciseImport(validFile()).length, 2);
});

test("all problems are reported together", () => {
  const file = validFile({ version: 3 });
  file.exercises[0] = { ...file.exercises[0], equipment: "smith", difficulty: "expert" };

  assert.throws(
    () => validateExerciseImport(file),
    (error) => {
      const lines = error.message.split("\n");
      assert.equal(lines[0], "Exercise import is invalid:");
      assert.deepEqual(lines.slice(1), [
        "- version must be 1",
        "- exercises[0].equipment must be one of: barbell, dumbbell, kettlebell, cable, machine, bodyweight, band",
        "- exercises[0].difficulty must be one of: beginner, intermediate, advanced",
      ]);
      return true;
    },
  );
});
