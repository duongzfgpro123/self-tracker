// RPE 1-10 in half steps (8, 8.5, 9); null when not recorded.
module.exports = {
  version: 10,
  name: "set_log_rpe",
  sql: `
    ALTER TABLE set_log ADD COLUMN rpe REAL
      CHECK (rpe IS NULL OR (rpe BETWEEN 1 AND 10 AND rpe * 2 = CAST(rpe * 2 AS INTEGER)))
  `,
};
