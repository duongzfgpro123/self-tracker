# Exercise Import Format

Version 1 of the JSON format used to load exercises into Self Tracker. The built-in seed (migration 014) uses it, and future import features will too. The validator is `validateExerciseImport` in `src/main/db/exercise-format.js`.

## Example

```json
{
  "format": "self-tracker-exercises",
  "version": 1,
  "exercises": [
    {
      "name": "Back squat",
      "movement_pattern": "squat",
      "equipment": "barbell",
      "difficulty": "intermediate",
      "instructions": null,
      "common_mistakes": null,
      "muscles": [
        { "name": "Quadriceps", "role": "primary" },
        { "name": "Gluteus maximus", "role": "secondary" }
      ]
    }
  ]
}
```

## File

| Key | Rule |
| --- | --- |
| `format` | Exactly `"self-tracker-exercises"`. |
| `version` | Exactly `1`. |
| `exercises` | A non-empty array of exercise objects. |

## Exercise

| Key | Required | Rule |
| --- | --- | --- |
| `name` | yes | Text. Leading and trailing spaces are removed. Must be unique in the file, ignoring case. |
| `movement_pattern` | yes | One of `horizontal_push`, `horizontal_pull`, `vertical_push`, `vertical_pull`, `squat`, `hinge`, `lunge`, `carry`, `core`, `isolation`. |
| `equipment` | yes | One of `barbell`, `dumbbell`, `kettlebell`, `cable`, `machine`, `bodyweight`, `band`. |
| `difficulty` | yes | One of `beginner`, `intermediate`, `advanced`. |
| `instructions` | no | Text or `null`. Blank text becomes `null`. |
| `common_mistakes` | no | Text or `null`. Blank text becomes `null`. |
| `muscles` | no | Array of muscle links; missing means no links. |

## Muscle link

| Key | Required | Rule |
| --- | --- | --- |
| `name` | yes | A muscle name exactly as stored in the `muscle` table (for example `Quadriceps`). A muscle may appear only once per exercise. |
| `role` | yes | One of `primary`, `secondary`, `stabiliser`. |

## Validation

- Unknown keys are rejected at every level, so a typo such as `"dificulty"` is reported instead of ignored.
- When the caller passes the known muscle names, each link must name one of them.
- Every problem is collected and reported in one error, each line naming its path, for example `exercises[2].difficulty must be one of: beginner, intermediate, advanced`.
- Instruction and common-mistake text must come from a cited source; the format has no sources field yet (planned in M5-012).
