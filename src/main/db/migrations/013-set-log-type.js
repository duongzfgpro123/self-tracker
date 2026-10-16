// Existing rows become 'working' through the column default.
module.exports = {
  version: 13,
  name: "set_log_type",
  sql: `
    ALTER TABLE set_log ADD COLUMN set_type TEXT NOT NULL DEFAULT 'working'
      CHECK (set_type IN ('warmup', 'working', 'drop'))
  `,
};
