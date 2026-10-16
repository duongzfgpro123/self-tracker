// Exercise import JSON format, version 1 (see docs/exercise-import-format.md). Pure validation, no database access.
const FORMAT = "self-tracker-exercises";
const VERSION = 1;
const MOVEMENT_PATTERNS = [
  "horizontal_push",
  "horizontal_pull",
  "vertical_push",
  "vertical_pull",
  "squat",
  "hinge",
  "lunge",
  "carry",
  "core",
  "isolation",
];
const EQUIPMENT = ["barbell", "dumbbell", "kettlebell", "cable", "machine", "bodyweight", "band"];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const MUSCLE_ROLES = ["primary", "secondary", "stabiliser"];

const FILE_KEYS = ["format", "version", "exercises"];
const EXERCISE_KEYS = [
  "name",
  "movement_pattern",
  "equipment",
  "difficulty",
  "instructions",
  "common_mistakes",
  "muscles",
];
const MUSCLE_KEYS = ["name", "role"];

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkKeys(value, allowedKeys, path, problems) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) problems.push(`${path} has unknown key "${key}"`);
  }
}

function requiredText(value, path, problems) {
  if (typeof value !== "string" || value.trim() === "") {
    problems.push(`${path} is required text`);
    return null;
  }
  return value.trim();
}

function optionalText(value, path, problems) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    problems.push(`${path} must be text or null`);
    return null;
  }
  return value.trim() || null;
}

function oneOf(value, allowed, path, problems) {
  if (!allowed.includes(value)) {
    problems.push(`${path} must be one of: ${allowed.join(", ")}`);
    return null;
  }
  return value;
}

function validateMuscles(value, path, knownMuscles, problems) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    problems.push(`${path} must be an array`);
    return [];
  }

  const seen = new Set();
  return value.map((muscle, index) => {
    const musclePath = `${path}[${index}]`;
    if (!isPlainObject(muscle)) {
      problems.push(`${musclePath} must be an object`);
      return null;
    }
    checkKeys(muscle, MUSCLE_KEYS, musclePath, problems);

    const name = requiredText(muscle.name, `${musclePath}.name`, problems);
    if (name !== null) {
      if (knownMuscles && !knownMuscles.has(name)) problems.push(`${musclePath}.name "${name}" is not a known muscle`);
      if (seen.has(name)) problems.push(`${musclePath}.name "${name}" is listed twice`);
      seen.add(name);
    }
    return { name, role: oneOf(muscle.role, MUSCLE_ROLES, `${musclePath}.role`, problems) };
  });
}

function validateExerciseImport(data, { muscleNames } = {}) {
  const problems = [];
  const knownMuscles = muscleNames ? new Set(muscleNames) : null;

  if (!isPlainObject(data)) throw new Error("Exercise import is invalid:\n- file must be a JSON object");
  checkKeys(data, FILE_KEYS, "file", problems);
  if (data.format !== FORMAT) problems.push(`format must be "${FORMAT}"`);
  if (data.version !== VERSION) problems.push(`version must be ${VERSION}`);

  let exercises = [];
  if (!Array.isArray(data.exercises) || data.exercises.length === 0) {
    problems.push("exercises must be a non-empty array");
  } else {
    const seenNames = new Set();
    exercises = data.exercises.map((exercise, index) => {
      const path = `exercises[${index}]`;
      if (!isPlainObject(exercise)) {
        problems.push(`${path} must be an object`);
        return null;
      }
      checkKeys(exercise, EXERCISE_KEYS, path, problems);

      const name = requiredText(exercise.name, `${path}.name`, problems);
      if (name !== null) {
        if (seenNames.has(name.toLowerCase())) problems.push(`${path}.name "${name}" is a duplicate`);
        seenNames.add(name.toLowerCase());
      }

      return {
        name,
        movement_pattern: oneOf(exercise.movement_pattern, MOVEMENT_PATTERNS, `${path}.movement_pattern`, problems),
        equipment: oneOf(exercise.equipment, EQUIPMENT, `${path}.equipment`, problems),
        difficulty: oneOf(exercise.difficulty, DIFFICULTIES, `${path}.difficulty`, problems),
        instructions: optionalText(exercise.instructions, `${path}.instructions`, problems),
        common_mistakes: optionalText(exercise.common_mistakes, `${path}.common_mistakes`, problems),
        muscles: validateMuscles(exercise.muscles, `${path}.muscles`, knownMuscles, problems),
      };
    });
  }

  if (problems.length > 0) {
    throw new Error(`Exercise import is invalid:\n- ${problems.join("\n- ")}`);
  }
  return exercises;
}

module.exports = {
  DIFFICULTIES,
  EQUIPMENT,
  FORMAT,
  MOVEMENT_PATTERNS,
  MUSCLE_ROLES,
  VERSION,
  validateExerciseImport,
};
