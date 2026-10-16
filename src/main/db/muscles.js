function listMuscles(database) {
  return database
    .prepare("SELECT id, name, group_name FROM muscle ORDER BY group_name, name")
    .all()
    .map(({ id, name, group_name }) => ({ id, name, group_name }));
}

module.exports = { listMuscles };
