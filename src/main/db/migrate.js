const { getSchemaVersion } = require("./schema");

function runMigrations(database, migrations) {
  const orderedMigrations = [...migrations].sort((left, right) => left.version - right.version);

  for (let index = 0; index < orderedMigrations.length; index += 1) {
    const migration = orderedMigrations[index];
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new Error(`Migration at index ${index} must have a positive integer version.`);
    }
    if (typeof migration.name !== "string" || typeof migration.sql !== "string") {
      throw new Error(`Migration ${migration.version} must have a string name and SQL.`);
    }
    if (index > 0 && orderedMigrations[index - 1].version === migration.version) {
      throw new Error(`Duplicate migration version ${migration.version}.`);
    }
  }

  const currentVersion = getSchemaVersion(database);
  const newestKnownVersion = orderedMigrations.length
    ? orderedMigrations[orderedMigrations.length - 1].version
    : 0;

  if (currentVersion > newestKnownVersion) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than the newest known migration ${newestKnownVersion}.`,
    );
  }

  const recordMigration = database.prepare(
    "INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)",
  );

  for (const migration of orderedMigrations) {
    if (migration.version <= currentVersion) continue;

    let transactionStarted = false;
    try {
      database.exec("BEGIN");
      transactionStarted = true;
      database.exec(migration.sql);
      recordMigration.run(migration.version, migration.name, new Date().toISOString());
      database.exec("COMMIT");
      transactionStarted = false;
    } catch (error) {
      let rollbackError;
      if (transactionStarted) {
        try {
          database.exec("ROLLBACK");
        } catch (rollbackFailure) {
          rollbackError = rollbackFailure;
        }
      }

      const rollbackMessage = rollbackError
        ? ` Rollback also failed: ${rollbackError.message}`
        : "";
      throw new Error(
        `Failed to apply migration ${migration.version} (${migration.name}): ${error.message}.${rollbackMessage}`,
        { cause: error },
      );
    }
  }
}

module.exports = { runMigrations };
