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
export function seed(db, stock = inventory) {
  db.run(
    "CREATE TABLE inventory (id INTEGER PRIMARY KEY, name TEXT, category TEXT, price INTEGER, cursed INTEGER)",
  );
  const stmt = db.prepare("INSERT INTO inventory VALUES (?, ?, ?, ?, ?)");
  stock.forEach((row) =>
    stmt.run([row.id, row.name, row.category, row.price, row.cursed]),
  );
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
export function makeStock(random = Math.random) {
  return categories.flatMap((category) => {
    const pool = inventory.filter((item) => item.category === category);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool
      .slice(0, 6)
      .map((item) => ({
        ...item,
        price: 3 + Math.floor(random() * 40),
        cursed: random() < 0.3 ? 1 : 0,
      }));
  });
}
export function orderFor(
  index,
  random = Math.random,
  opening = createOpeningOrders(random),
  stock = inventory,
  shift = 1,
  shiftOrder = index,
) {
  if (!stock.length) throw new Error("The shop is sold out.");
  const sample = stock[Math.floor(random() * stock.length)];
  const category = sample.category;
  const budget = sample.price + 1 + Math.floor(random() * 10);
  const basics = [
    {
      text: "Let me see everything still on your shelves. Just browsing!",
      sql: "SELECT * FROM inventory;",
      concept: "SELECT",
      hint: "SELECT * chooses every column. FROM inventory names the table.",
      starter: "SELECT *\nFROM inventory;",
    },
    {
      text: `Show me every ${category} you have. I'm only looking.`,
      sql: `SELECT * FROM inventory WHERE category = '${category}';`,
      concept: "WHERE",
      hint: `Filter with WHERE category = '${category}'. Text needs single quotes.`,
      starter: "SELECT *\nFROM inventory\nWHERE ",
    },
    {
      text: `Show me everything cheaper than ${budget} gold. Just comparing prices.`,
      sql: `SELECT * FROM inventory WHERE price < ${budget};`,
      concept: "Numbers",
      hint: `Use WHERE price < ${budget}. Numbers do not need quotes.`,
      starter: "SELECT *\nFROM inventory\nWHERE ",
    },
  ];
  const inquiry = (base) => ({
    ...base,
    kind: "inquiry",
    ordered: false,
    requirement:
      base.requirement ||
      "Return every column with SELECT *. Inquiries do not sell stock.",
  });
  if (index < 3) return inquiry(basics[opening[index]]);
  if (stock.length > 3 && shiftOrder % 4 === 3) {
    if (shift >= 3)
      return inquiry({
        text: "How many items do you have in each category? I'm planning a party, not buying yet.",
        sql: "SELECT category, COUNT(*) AS total FROM inventory GROUP BY category;",
        concept: "GROUP BY",
        hint: "SELECT category, COUNT(*) AS total FROM inventory GROUP BY category counts each category separately.",
        starter:
          "SELECT category, COUNT(*) AS total\nFROM inventory\nGROUP BY ",
        requirement:
          "Return category and COUNT(*) AS total. Stock stays on the shelves.",
      });
    if (shift === 2)
      return inquiry({
        text: `How many ${category} items are left? Just checking.`,
        sql: `SELECT COUNT(*) AS total FROM inventory WHERE category = '${category}';`,
        concept: "COUNT",
        hint: `COUNT(*) counts rows. Name the column with AS total and filter category = '${category}'.`,
        starter: "SELECT COUNT(*) AS total\nFROM inventory\nWHERE ",
        requirement:
          "Return one column named total. This is an inquiry, not a purchase.",
      });
    return inquiry(basics[Math.floor(random() * basics.length)]);
  }
  let filter = `category = '${category}'`;
  let eligible = stock.filter((item) => item.category === category);
  let description = `${category} items`;
  let concept = "ORDER BY + LIMIT";
  if (shift >= 2) {
    filter += ` AND cursed = ${sample.cursed}`;
    eligible = eligible.filter((item) => item.cursed === sample.cursed);
    description = `${sample.cursed ? "cursed" : "uncursed"} ${category} items`;
    concept = "AND + sorting";
  }
  if (shift >= 3) {
    const low = Math.max(0, sample.price - 8),
      high = sample.price + 8;
    filter += ` AND price BETWEEN ${low} AND ${high}`;
    eligible = eligible.filter(
      (item) => item.price >= low && item.price <= high,
    );
    description += ` costing ${low} to ${high} gold each, inclusive`;
    concept = "BETWEEN + AND";
  }
  if (shift >= 4) {
    const other =
      stock.find((item) => item.category !== category)?.category || category;
    filter = `(category = '${category}' OR category = '${other}') AND cursed = ${sample.cursed} AND price <= ${budget}`;
    eligible = stock.filter(
      (item) =>
        (item.category === category || item.category === other) &&
        item.cursed === sample.cursed &&
        item.price <= budget,
    );
    description = `${sample.cursed ? "cursed" : "uncursed"} items from either ${category} or ${other}, at most ${budget} gold each`;
    concept = "OR + AND";
  }
  const count = Math.min(1 + Math.floor(random() * 3), eligible.length);
  return {
    kind: "purchase",
    text: `I'll buy your ${count} cheapest ${description}. Cheapest first, please!`,
    sql: `SELECT * FROM inventory WHERE ${filter} ORDER BY price ASC, id ASC LIMIT ${count};`,
    concept,
    ordered: true,
    starter: "SELECT *\nFROM inventory\nWHERE ",
    hint: `Filter with ${filter}. Then ORDER BY price ASC, id ASC LIMIT ${count}.`,
    requirement: `Return all columns, sorted by price then id (smallest first). Sell exactly ${count} item${count === 1 ? "" : "s"}.`,
  };
}
export function completeOrder(stock, order, actual, expected, streak) {
  if (!sameResult(actual, expected, order.ordered)) return null;
  const tip = 10 * (1 + Math.floor(streak / 3));
  if (order.kind === "inquiry")
    return { stock, earned: tip, sale: 0, tip, sold: 0 };
  const ids = actual.values.map((row) => row[actual.columns.indexOf("id")]);
  const selected = stock.filter((item) => ids.includes(item.id));
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    selected.length !== ids.length
  )
    return null;
  const sale = selected.reduce((sum, item) => sum + item.price, 0);
  return {
    stock: stock.filter((item) => !ids.includes(item.id)),
    earned: sale + tip,
    sale,
    tip,
    sold: ids.length,
  };
}
export function advanceShift(state, random = Math.random) {
  if (state.stock.length || state.hearts <= 0)
    throw new Error("Finish selling the stock before restocking.");
  return {
    ...state,
    shift: state.shift + 1,
    shiftOrder: 0,
    index: state.index + 1,
    stock: makeStock(random),
    shiftStartGold: state.score,
    patience: 80,
    remaining: 80,
    roundPatience: 80,
    shiftComplete: false,
    paused: false,
    departed: null,
  };
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
