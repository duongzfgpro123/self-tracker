// Reps in reserve, 0-10; null when not recorded.
module.exports = {
  version: 11,
  name: "set_log_rir",
  sql: `
    ALTER TABLE set_log ADD COLUMN rir INTEGER
      CHECK (rir IS NULL OR rir BETWEEN 0 AND 10)
  `,
};
