module.exports = {
  version: 2,
  name: "goal",
  sql: `
    CREATE TABLE goal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('muscle_gain', 'maintenance', 'fat_loss', 'general_health')),
      target_weight_kg REAL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      notes TEXT,
      created_at TEXT NOT NULL
    )
  `,
};
