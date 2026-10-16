// INSERT OR IGNORE keeps the seed safe to re-run: existing muscle names are left unchanged.
module.exports = {
  version: 6,
  name: "seed_muscles",
  sql: `
    INSERT OR IGNORE INTO muscle (name, group_name) VALUES
      ('Pectoralis major', 'Chest'),
      ('Latissimus dorsi', 'Back'),
      ('Trapezius', 'Back'),
      ('Rhomboids', 'Back'),
      ('Erector spinae', 'Back'),
      ('Anterior deltoid', 'Shoulders'),
      ('Lateral deltoid', 'Shoulders'),
      ('Posterior deltoid', 'Shoulders'),
      ('Biceps brachii', 'Arms'),
      ('Triceps brachii', 'Arms'),
      ('Forearm flexors', 'Arms'),
      ('Forearm extensors', 'Arms'),
      ('Quadriceps', 'Legs'),
      ('Hamstrings', 'Legs'),
      ('Gluteus maximus', 'Legs'),
      ('Gluteus medius', 'Legs'),
      ('Hip adductors', 'Legs'),
      ('Hip flexors', 'Legs'),
      ('Calves', 'Legs'),
      ('Rectus abdominis', 'Core'),
      ('Obliques', 'Core');
  `,
};
