import test from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";
import { seed, query, orderFor, sameResult } from "../src/game.js";
const SQL = await initSqlJs();
function db() {
  const database = new SQL.Database();
  seed(database);
  return database;
}
test("inventory and every generated order have real results", () => {
  const database = db();
  assert.equal(query(database, "SELECT * FROM inventory").values.length, 40);
  for (let i = 0; i < 100; i++) {
    const order = orderFor(i);
    assert.ok(query(database, order.sql).values.length > 0);
  }
  database.close();
});
test("alternative SQL and column order pass; missing rows and duplicates fail", () => {
  const database = db();
  const expected = query(
    database,
    "SELECT * FROM inventory WHERE category = 'potion'",
  );
  assert.ok(
    sameResult(
      query(
        database,
        "SELECT cursed, price, category, name, id FROM inventory WHERE category IN ('potion') ORDER BY id DESC",
      ),
      expected,
    ),
  );
  assert.ok(
    !sameResult(query(database, "SELECT * FROM inventory LIMIT 2"), expected),
  );
  assert.ok(
    !sameResult(
      { ...expected, values: [...expected.values, ...expected.values] },
      expected,
    ),
  );
  database.close();
});
test("ordered challenges require correct ordering", () => {
  const database = db();
  const result = query(
    database,
    "SELECT * FROM inventory ORDER BY price LIMIT 3",
  );
  assert.ok(
    !sameResult(
      { ...result, values: [...result.values].reverse() },
      result,
      true,
    ),
  );
  database.close();
});
test("database stays read only and rejects multiple statements", () => {
  const database = db();
  assert.throws(() => query(database, "DELETE FROM inventory"));
  assert.throws(() =>
    query(database, "SELECT * FROM inventory; DELETE FROM inventory"),
  );
  assert.throws(() => query(database, "SELECT 1; SELECT 2"));
  assert.equal(query(database, "SELECT * FROM inventory").values.length, 40);
  assert.equal(query(database, "SELECT ';' AS semicolon").values[0][0], ";");
  database.close();
});
test("invalid SQL gives an error and a following query still works", () => {
  const database = db();
  assert.throws(() => query(database, "SELECT potato FROM inventory"));
  assert.equal(
    query(database, "SELECT COUNT(*) AS total FROM inventory").values[0][0],
    40,
  );
  database.close();
});

import {
  isUntimed,
  patienceAfterSuccess,
  patienceAfterLifeLost,
} from "../src/game.js";
test("only the first three arcade orders are untimed; practice always is", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((i) => isUntimed(i, "arcade")),
    [true, true, true, false, false],
  );
  assert.equal(isUntimed(100, "practice"), true);
});
test("multiplier milestones shorten patience and stop at thirty seconds", () => {
  let patience = 90;
  const rounds = [];
  for (let streak = 1; streak <= 24; streak++) {
    patience = patienceAfterSuccess(patience, streak);
    if (streak % 3 === 0) rounds.push(patience);
  }
  assert.deepEqual(rounds, [80, 70, 60, 50, 40, 30, 30, 30]);
});
test("life loss restores eighty seconds; the next milestone reduces it again", () => {
  let patience = patienceAfterLifeLost();
  assert.equal(patience, 80);
  assert.equal(patienceAfterSuccess(patience, 0), 80);
  assert.equal(patienceAfterSuccess(patience, 1), 80);
  assert.equal(patienceAfterSuccess(patience, 2), 80);
  assert.equal(patienceAfterSuccess(patience, 3), 70);
});

import { createOpeningOrders } from "../src/game.js";
test("opening orders shuffle the three beginner skills without duplicates", () => {
  const first = createOpeningOrders(() => 0);
  const second = createOpeningOrders(() => 0.999);
  assert.notDeepEqual(first, second);
  assert.deepEqual([...first].sort(), [0, 1, 2]);
  assert.deepEqual([...second].sort(), [0, 1, 2]);
  assert.deepEqual(
    first.map((_, i) => orderFor(i, () => 0, first).concept),
    ["WHERE", "Numbers", "SELECT"],
  );
  const database = db();
  for (let i = 0; i < 3; i++)
    assert.ok(query(database, orderFor(i, () => 0, first).sql).values.length);
  database.close();
});

import { makeStock, completeOrder, advanceShift } from "../src/game.js";
function rng(seedValue) {
  let n = seedValue;
  return () => {
    n = (1664525 * n + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
function queryStock(stock, sql) {
  const database = new SQL.Database();
  seed(database, stock);
  try {
    return query(database, sql);
  } finally {
    database.close();
  }
}
test("restocks vary but always contain 24 unique items across four categories", () => {
  const first = makeStock(rng(1)),
    second = makeStock(rng(2));
  assert.equal(first.length, 24);
  assert.equal(new Set(first.map((i) => i.id)).size, 24);
  assert.notDeepEqual(first, second);
  for (const category of ["potion", "weapon", "charm", "snack"])
    assert.equal(first.filter((i) => i.category === category).length, 6);
});
test("purchases remove only selected stock and credit item value plus a streak tip", () => {
  const stock = makeStock(rng(4));
  const order = orderFor(4, () => 0, [0, 1, 2], stock, 2, 0);
  const expected = queryStock(stock, order.sql);
  const wrong = { ...expected, values: [] };
  assert.equal(completeOrder(stock, order, wrong, expected, 3), null);
  assert.equal(stock.length, 24);
  const done = completeOrder(stock, order, expected, expected, 3);
  assert.equal(done.tip, 20);
  assert.equal(done.stock.length, 24 - expected.values.length);
  assert.equal(done.earned, done.sale + 20);
  const soldIds = expected.values.map(
    (row) => row[expected.columns.indexOf("id")],
  );
  assert.ok(done.stock.every((item) => !soldIds.includes(item.id)));
  assert.equal(completeOrder(done.stock, order, expected, expected, 3), null);
});
test("aggregate inquiries do not consume stock", () => {
  const stock = makeStock(rng(5));
  for (const shift of [2, 3, 4]) {
    const order = orderFor(7, () => 0, [0, 1, 2], stock, shift, 3);
    assert.equal(order.kind, "inquiry");
    const expected = queryStock(stock, order.sql);
    const done = completeOrder(stock, order, expected, expected, 0);
    assert.equal(done.stock, stock);
    assert.equal(done.sold, 0);
    assert.equal(done.sale, 0);
    assert.equal(done.earned, 10);
  }
});
test("depleting inventories remain fulfillable through multiple difficulty tiers", () => {
  for (let shift = 1; shift <= 5; shift++)
    for (let seedValue = 1; seedValue <= 8; seedValue++) {
      const random = rng(seedValue),
        opening = createOpeningOrders(random);
      let stock = makeStock(random),
        round = 0;
      while (stock.length && round < 100) {
        const order = orderFor(
          shift === 1 ? round : round + 50,
          random,
          opening,
          stock,
          shift,
          round,
        );
        const expected = queryStock(stock, order.sql);
        assert.ok(expected.values.length > 0);
        const done = completeOrder(stock, order, expected, expected, round);
        assert.ok(done);
        if (order.kind === "purchase")
          assert.ok(done.sold >= 1 && done.sold <= 3);
        stock = done.stock;
        round++;
      }
      assert.equal(
        stock.length,
        0,
        `shift ${shift} seed ${seedValue} failed to sell out`,
      );
    }
});
test("new shifts preserve gold, hearts, and total order count without another tutorial", () => {
  const before = {
    stock: [],
    shift: 1,
    shiftOrder: 20,
    index: 20,
    score: 777,
    hearts: 2,
    streak: 8,
    shiftComplete: true,
    paused: true,
    patience: 30,
    mode: "arcade",
  };
  const next = advanceShift(before, rng(42));
  assert.equal(next.score, 777);
  assert.equal(next.hearts, 2);
  assert.equal(next.streak, 8);
  assert.equal(next.shift, 2);
  assert.equal(next.shiftOrder, 0);
  assert.equal(next.index, 21);
  assert.equal(next.patience, 80);
  assert.equal(next.stock.length, 24);
  assert.equal(next.shiftStartGold, 777);
  assert.equal(isUntimed(next.index, next.mode), false);
  assert.equal(isUntimed(next.index, "practice"), true);
  assert.throws(() => advanceShift({ ...before, hearts: 0 }));
  assert.throws(() => advanceShift({ ...before, stock: makeStock(rng(1)) }));
});
