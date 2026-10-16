module.exports = {
  version: 1,
  name: "user_profile",
  sql: `
    CREATE TABLE user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      display_name TEXT,
      units TEXT NOT NULL DEFAULT 'kg' CHECK (units IN ('kg', 'lb')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `,
};
