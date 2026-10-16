// Rest taken after the set, in seconds; null when not recorded.
module.exports = {
  version: 12,
  name: "set_log_rest",
  sql: `
    ALTER TABLE set_log ADD COLUMN rest_seconds INTEGER
      CHECK (rest_seconds IS NULL OR rest_seconds >= 0)
  `,
};
