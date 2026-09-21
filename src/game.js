export const categories = ["potion", "weapon", "charm", "snack"];
const names = [
  [
    "Moonmilk",
    "Swamp Tonic",
    "Liquid Courage",
    "Moss Remedy",
    "Bottled Luck",
    "Frog Fizz",
    "Dream Draught",
    "Witch Tea",
    "Sun Syrup",
    "Ghost Juice",
  ],
  [
    "Rusty Dagger",
    "Soup Sword",
    "Tiny Axe",
    "Bone Bow",
    "Mushroom Mace",
    "Bent Spear",
    "Silver Fork",
    "Bog Blade",
    "Rat Rapier",
    "Wooden Wand",
  ],
  [
    "Lucky Tooth",
    "Pocket Moon",
    "Goblin Ring",
    "Glass Eye",
    "Clover Brooch",
    "Stone Star",
    "Bat Pendant",
    "Copper Bell",
    "Snail Shell",
    "Cursed Button",
  ],
  [
    "Crispy Beetles",
    "Moon Cheese",
    "Moss Biscuit",
    "Pickled Slugs",
    "Honey Rocks",
    "Bog Berries",
    "Worm Jerky",
    "Frog Cake",
    "Toad Toast",
    "Spicy Roots",
  ],
];
export const inventory = categories.flatMap((category, c) =>
  names[c].map((name, i) => ({
    id: c * 10 + i + 1,
    name,
    category,
    price: 3 + i * 4 + c,
    cursed: i % 3 === 0 ? 1 : 0,
  })),
);
export function seed(db) {
  db.run(
    "CREATE TABLE inventory (id INTEGER PRIMARY KEY, name TEXT, category TEXT, price INTEGER, cursed INTEGER)",
  );
  const stmt = db.prepare("INSERT INTO inventory VALUES (?, ?, ?, ?, ?)");
  inventory.forEach((row) => stmt.run(Object.values(row)));
  stmt.free();
  db.run("PRAGMA query_only = ON");
}
export function createOpeningOrders(random = Math.random) {
  const types = [0, 1, 2];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}
export function orderFor(
  index,
  random = Math.random,
  opening = createOpeningOrders(random),
) {
  const category = categories[Math.floor(random() * 4)];
  const budget = 15 + Math.floor(random() * 5) * 5;
  const count = 2 + Math.floor(random() * 3);
  const templates = [
    {
      text: "Let me see everything in the shop. Yes, even the suspicious bits.",
      sql: "SELECT * FROM inventory;",
      concept: "SELECT",
      hint: "SELECT chooses columns. The star (*) means every column. FROM names the table.",
      starter: "SELECT *\nFROM inventory;",
      ordered: false,
    },
    {
      text: `Show me every ${category}. I have very particular hobbies.`,
      sql: `SELECT * FROM inventory WHERE category = '${category}';`,
      concept: "WHERE",
      hint: `WHERE filters rows. Text values need single quotes: category = '${category}'.`,
      starter: "SELECT *\nFROM inventory\nWHERE ",
      ordered: false,
    },
    {
      text: `Show me everything cheaper than ${budget} gold. Goblin economy, you know.`,
      sql: `SELECT * FROM inventory WHERE price < ${budget};`,
      concept: "Numbers",
      hint: `Use WHERE price < ${budget}. Numbers do not need quotes. Cheaper than means strictly less than.`,
      starter: "SELECT *\nFROM inventory\nWHERE ",
      ordered: false,
    },
    {
      text: `Every uncursed ${category}, please. Last time was a whole thing.`,
      sql: `SELECT * FROM inventory WHERE category = '${category}' AND cursed = 0;`,
      concept: "AND",
      hint: `Combine conditions with AND. Use category = '${category}' AND cursed = 0.`,
      starter: "SELECT *\nFROM inventory\nWHERE ",
      ordered: false,
    },
    {
      text: `Your ${count} cheapest items, cheapest first. If prices tie, smaller id first.`,
      sql: `SELECT * FROM inventory ORDER BY price ASC, id ASC LIMIT ${count};`,
      concept: "ORDER BY + LIMIT",
      hint: `ORDER BY price ASC, id ASC sorts from low to high, then by id. LIMIT ${count} keeps only ${count} rows.`,
      starter: "SELECT *\nFROM inventory\nORDER BY ",
      ordered: true,
    },
  ];
  return templates[
    index < 3 ? opening[index] : index < 5 ? index : Math.floor(random() * 5)
  ];
}
export function sameResult(actual, expected, ordered = false) {
  if (!actual || !expected || actual.columns.length !== expected.columns.length)
    return false;
  const cols = expected.columns;
  if (!cols.every((c) => actual.columns.includes(c))) return false;
  const rows = actual.values.map((r) =>
    JSON.stringify(cols.map((c) => r[actual.columns.indexOf(c)])),
  );
  const target = expected.values.map((r) => JSON.stringify(r));
  if (!ordered) {
    rows.sort();
    target.sort();
  }
  return JSON.stringify(rows) === JSON.stringify(target);
}
export function query(db, sql) {
  if (!/^\s*SELECT\b/i.test(sql))
    throw new Error("Start with SELECT. This shop accepts read-only queries.");
  // SQLite parses statements, so semicolons inside strings remain valid.
  const statements = db.iterateStatements(sql);
  let count = 0;
  let result;
  try {
    for (const stmt of statements) {
      count++;
      if (count > 1) throw new Error("Run one SELECT statement at a time.");
      const columns = stmt.getColumnNames();
      const values = [];
      while (stmt.step()) {
        if (values.length >= 500)
          throw new Error("Too many rows. Try a filter or LIMIT 500.");
        values.push(stmt.get());
      }
      result = { columns, values };
    }
  } finally {
    statements.return?.();
  }
  if (!result) throw new Error("Write a SELECT query first.");
  return result;
}

export function isUntimed(index, mode) {
  return index < 3 || mode === "practice";
}
export function patienceAfterSuccess(patience, streak) {
  return streak > 0 && streak % 3 === 0
    ? Math.max(30, patience - 10)
    : patience;
}
export function patienceAfterLifeLost() {
  return 80;
}
