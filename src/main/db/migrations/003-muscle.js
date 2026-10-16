module.exports = {
  version: 3,
  name: "muscle",
  sql: `
    CREATE TABLE muscle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      group_name TEXT NOT NULL CHECK (group_name IN ('Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'))
    )
  `,
};
