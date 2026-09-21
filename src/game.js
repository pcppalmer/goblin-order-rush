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
// IDs are internal game bookkeeping; players work with unique item names.
export function seed(db, stock = inventory, market = null) {
  for (const [table, rows] of [
    ["inventory", stock],
    ["black_market", market],
  ]) {
    if (rows === null) continue;
    db.run(
      `CREATE TABLE ${table} (name TEXT PRIMARY KEY, category TEXT, price INTEGER, cursed INTEGER)`,
    );
    const stmt = db.prepare(`INSERT INTO ${table} VALUES (?, ?, ?, ?)`);
    rows.forEach((row) =>
      stmt.run([row.name, row.category, row.price, row.cursed]),
    );
    stmt.free();
  }
  db.run("PRAGMA query_only = ON");
}
export function makeMarket(random = Math.random, shift = 1) {
  if (shift < 2) return null;
  const secretNames = [
    "Midnight Elixir",
    "Bottled Thunder",
    "Whisper Knife",
    "Ghost Hammer",
    "Stolen Halo",
    "Hex Locket",
    "Forbidden Fudge",
    "Shadow Truffles",
  ];
  return secretNames.map((name, i) => ({
    id: 101 + i,
    name,
    category: categories[Math.floor(i / 2)],
    price: 12 + Math.floor(random() * 35),
    cursed: random() < 0.5 ? 1 : 0,
  }));
}
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
export function marketOrder(shift, shiftOrder, market) {
  if (!market?.length) return null;
  if (shift === 2 && shiftOrder === 1)
    return {
      kind: "inquiry",
      concept: "Discover black_market",
      ordered: true,
      text: "Psst. What's the cheapest item on the black market? Just tell me its name. You didn't hear this from me.",
      sql: "SELECT name FROM black_market ORDER BY price ASC, name ASC LIMIT 1;",
      starter: "SELECT *\nFROM black_market;",
      hint: "First explore SELECT * FROM black_market. Then select only name, sort by price ASC, name ASC, and LIMIT 1.",
      requirement:
        "Return only name for the cheapest item; break price ties alphabetically. This inquiry does not import or sell stock.",
    };
  if (shift >= 3 && shiftOrder === 2)
    return {
      kind: "import",
      concept: "JOIN + DISTINCT",
      ordered: true,
      text: "A midnight delivery! Source the three cheapest black-market items in categories we still carry. Let's give these suspicious treasures some shelf space.",
      sql: "SELECT DISTINCT b.name, b.category, b.price, b.cursed FROM black_market AS b JOIN inventory AS i ON b.category = i.category ORDER BY b.price ASC, b.name ASC LIMIT 3;",
      starter: "SELECT *\nFROM black_market;",
      hint: "Explore black_market first. JOIN inventory AS i ON b.category = i.category matches categories. Select DISTINCT b.name, b.category, b.price, b.cursed to avoid repeats, then ORDER BY b.price ASC, b.name ASC LIMIT 3.",
      requirement:
        "Return the four black-market columns, cheapest first, ties alphabetical. Import up to 3 matching items on consignment (no gold cost). One delivery opportunity per shift. JOIN finds stock; Import stock transfers it.",
    };
  return null;
}
export function createOpeningOrders(random = Math.random) {
  const types = [0, 1, 2];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}
export function makeStock(random = Math.random, shift = 2) {
  return categories.flatMap((category) => {
    const pool = inventory.filter((item) => item.category === category);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, shift === 1 ? 4 : 6).map((item) => ({
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
  previousVariant = null,
  market = null,
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
  const delivery = marketOrder(shift, shiftOrder, market);
  if (delivery) return delivery;
  if (shift > 1 && stock.length > 6 && shiftOrder % 4 === 3) {
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
  if (
    previousVariant !== "named" &&
    (random() < (shift === 1 ? 0.22 : 0.45) ||
      (shift === 1 && previousVariant === "everything"))
  ) {
    const pool = [...stock];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const count = Math.min(
      stock.length,
      shift === 1 ? 3 + Math.floor(random() * 3) : 1 + Math.floor(random() * 5),
    );
    const wanted = pool.slice(0, count).map((item) => item.name);
    const filter =
      count === 1
        ? `name = ${quote(wanted[0])}`
        : `name IN (${wanted.map(quote).join(", ")})`;
    return {
      kind: "purchase",
      variant: "named",
      ordered: false,
      concept: count === 1 ? "WHERE name" : "Names + IN",
      text: `I'll buy ${wanted.map((name) => `“${name}”`).join(", ")}. My shopping list is very specific. Don't ask why.`,
      sql: `SELECT * FROM inventory WHERE ${filter};`,
      starter: "SELECT *\nFROM inventory\nWHERE ",
      hint: `Use ${filter}. IN matches any name in a list; text goes inside single quotes.`,
      requirement: `Return all four columns for exactly these ${count} item${count === 1 ? "" : "s"}. Any row order is fine.`,
    };
  }
  if (shift === 1) {
    // Broad filters guarantee substantial baskets and a short first shift.
    const median = [...stock].sort((a, b) => a.price - b.price)[
      Math.floor(stock.length / 2)
    ].price;
    const candidates = [
      ...categories.map((c) => ({
        key: `category-${c}`,
        filter: `category = '${c}'`,
        matches: (item) => item.category === c,
        description: `${c} items`,
        flavor: "I've got a very specific shopping list.",
      })),
      ...[0, 1].map((c) => ({
        key: `curse-${c}`,
        filter: `cursed = ${c}`,
        matches: (item) => item.cursed === c,
        description: `${c ? "cursed" : "uncursed"} items`,
        flavor: c
          ? "For no reason. Absolutely no reason."
          : "My insurance insists.",
      })),
      {
        key: "budget",
        filter: `price <= ${median}`,
        matches: (item) => item.price <= median,
        description: `items costing at most ${median} gold each`,
        flavor: "A bargain is a bargain, even if it bites.",
      },
      {
        key: "luxury",
        filter: `price >= ${median}`,
        matches: (item) => item.price >= median,
        description: `items costing at least ${median} gold each`,
        flavor: "I have expensive goblin tastes.",
      },
      {
        key: "everything",
        filter: null,
        matches: () => true,
        description: "items in the shop",
        flavor: "I'm furnishing a very questionable dungeon.",
      },
    ].filter(
      (candidate) =>
        stock.filter(candidate.matches).length >= Math.min(3, stock.length),
    );
    const fresh = candidates.filter(
      (candidate) => candidate.key !== previousVariant,
    );
    const choices = fresh.length ? fresh : candidates;
    const chosen = choices[Math.floor(random() * choices.length)];
    const count = Math.min(
      3 + Math.floor(random() * 4),
      stock.filter(chosen.matches).length,
    );
    const descending = random() < 0.5;
    const direction = descending ? "DESC" : "ASC";
    const where = chosen.filter ? ` WHERE ${chosen.filter}` : "";
    return {
      kind: "purchase",
      variant: chosen.key,
      ordered: true,
      concept: chosen.filter ? "WHERE + sorting" : "ORDER BY + LIMIT",
      text: `I'll buy your ${count} ${descending ? "most expensive" : "cheapest"} ${count === 1 ? chosen.description.replace(/\bitems\b/g, "item") : chosen.description}! ${chosen.flavor}`,
      sql: `SELECT * FROM inventory${where} ORDER BY price ${direction}, name ASC LIMIT ${count};`,
      starter: `SELECT *\nFROM inventory\n${chosen.filter ? "WHERE " : "ORDER BY "}`,
      hint: `${chosen.filter ? `Filter with ${chosen.filter}. ` : "No filter needed. "}ORDER BY price ${direction} sorts ${descending ? "highest" : "lowest"} prices first. Break ties with name ASC, then LIMIT ${count}.`,
      requirement: `Return all columns, price ${descending ? "highest" : "lowest"} first; tied prices use alphabetical names first. Sell exactly ${count} item${count === 1 ? "" : "s"}.`,
    };
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
  const count = Math.min(3 + Math.floor(random() * 4), eligible.length);
  const direction = random() < 0.5 ? "DESC" : "ASC";
  const priceOrder = direction === "DESC" ? "most expensive" : "cheapest";
  return {
    kind: "purchase",
    text: `I'll buy your ${count} ${priceOrder} ${count === 1 ? description.replace(/\bitems\b/g, "item") : description}. ${direction === "DESC" ? "Only the best for my secret project!" : "My coin purse is mostly moths."}`,
    sql: `SELECT * FROM inventory WHERE ${filter} ORDER BY price ${direction}, name ASC LIMIT ${count};`,
    concept,
    ordered: true,
    starter: "SELECT *\nFROM inventory\nWHERE ",
    hint: `Filter with ${filter}. Then ORDER BY price ${direction}, name ASC LIMIT ${count}.`,
    requirement: `Return all columns, sorted by price ${direction === "DESC" ? "highest" : "lowest"} first, then name alphabetically. Sell exactly ${count} item${count === 1 ? "" : "s"}.`,
  };
}
export function completeOrder(
  stock,
  order,
  actual,
  expected,
  streak,
  market = null,
) {
  if (!sameResult(actual, expected, order.ordered)) return null;
  const tip = 10 * (1 + Math.floor(streak / 3));
  if (order.kind === "inquiry")
    return { stock, earned: tip, sale: 0, tip, sold: 0 };
  const selectedNames = actual.values.map(
    (row) => row[actual.columns.indexOf("name")],
  );
  const source = order.kind === "import" ? market || [] : stock;
  const selected = source.filter((item) => selectedNames.includes(item.name));
  if (
    !selectedNames.length ||
    new Set(selectedNames).size !== selectedNames.length ||
    selected.length !== selectedNames.length
  )
    return null;
  if (order.kind === "import") {
    if (
      selected.length > 3 ||
      selected.some((item) =>
        stock.some((existing) => existing.name === item.name),
      )
    )
      return null;
    return {
      stock: [...stock, ...selected],
      market: market.filter((item) => !selectedNames.includes(item.name)),
      earned: tip,
      sale: 0,
      tip,
      sold: 0,
      imported: selected.length,
    };
  }
  const sale = selected.reduce((sum, item) => sum + item.price, 0);
  return {
    stock: stock.filter((item) => !selectedNames.includes(item.name)),
    earned: sale + tip,
    sale,
    tip,
    sold: selected.length,
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
    stock: makeStock(random, state.shift + 1),
    market: makeMarket(random, state.shift + 1),
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
