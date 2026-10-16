// The seed data lives here, in the exercise import format, so this applied migration never changes later.
// Instructions, common mistakes and muscle links are added with sources in later tasks (M5-003, M5-007, M5-012).
// INSERT OR IGNORE keeps the seed safe to re-run: existing exercise names are left unchanged.
const exercises = [
  ["Barbell bench press", "horizontal_push", "barbell", "beginner"],
  ["Incline dumbbell press", "horizontal_push", "dumbbell", "beginner"],
  ["Push-up", "horizontal_push", "bodyweight", "beginner"],
  ["Dip", "vertical_push", "bodyweight", "intermediate"],
  ["Pull-up", "vertical_pull", "bodyweight", "intermediate"],
  ["Lat pulldown", "vertical_pull", "cable", "beginner"],
  ["Barbell row", "horizontal_pull", "barbell", "intermediate"],
  ["Seated cable row", "horizontal_pull", "cable", "beginner"],
  ["One-arm dumbbell row", "horizontal_pull", "dumbbell", "beginner"],
  ["Face pull", "horizontal_pull", "cable", "beginner"],
  ["Deadlift", "hinge", "barbell", "intermediate"],
  ["Overhead press", "vertical_push", "barbell", "intermediate"],
  ["Dumbbell shoulder press", "vertical_push", "dumbbell", "beginner"],
  ["Lateral raise", "isolation", "dumbbell", "beginner"],
  ["Barbell curl", "isolation", "barbell", "beginner"],
  ["Hammer curl", "isolation", "dumbbell", "beginner"],
  ["Triceps pushdown", "isolation", "cable", "beginner"],
  ["Overhead triceps extension", "isolation", "dumbbell", "beginner"],
  ["Back squat", "squat", "barbell", "intermediate"],
  ["Goblet squat", "squat", "dumbbell", "beginner"],
  ["Leg press", "squat", "machine", "beginner"],
  ["Romanian deadlift", "hinge", "barbell", "intermediate"],
  ["Walking lunge", "lunge", "dumbbell", "beginner"],
  ["Bulgarian split squat", "lunge", "dumbbell", "intermediate"],
  ["Hip thrust", "hinge", "barbell", "beginner"],
  ["Leg curl", "isolation", "machine", "beginner"],
  ["Standing calf raise", "isolation", "machine", "beginner"],
  ["Plank", "core", "bodyweight", "beginner"],
  ["Hanging leg raise", "core", "bodyweight", "intermediate"],
  ["Farmer's carry", "carry", "dumbbell", "beginner"],
].map(([name, movement_pattern, equipment, difficulty]) => ({ name, movement_pattern, equipment, difficulty }));

const seedFile = { format: "self-tracker-exercises", version: 1, exercises };

const quote = (text) => `'${text.replace(/'/g, "''")}'`;
const rows = exercises.map(
  ({ name, movement_pattern, equipment, difficulty }) =>
    `      (${[name, movement_pattern, equipment, difficulty].map(quote).join(", ")}, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
);

module.exports = {
  version: 14,
  name: "seed_exercises",
  seedFile,
  sql: `
    INSERT OR IGNORE INTO exercise (name, movement_pattern, equipment, difficulty, is_custom, created_at) VALUES
${rows.join(",\n")};
  `,
};
