module.exports = {
  version: 4,
  name: "exercise",
  sql: `
    CREATE TABLE exercise (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      movement_pattern TEXT,
      equipment TEXT,
      difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
      instructions TEXT,
      common_mistakes TEXT,
      is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0, 1)),
      created_at TEXT NOT NULL
    )
  `,
};
