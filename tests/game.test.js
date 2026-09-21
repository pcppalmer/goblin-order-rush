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
