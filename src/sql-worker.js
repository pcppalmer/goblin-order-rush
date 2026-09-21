import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { seed, query } from "./game.js";
const ready = initSqlJs({ locateFile: () => wasmUrl });
self.onmessage = async ({ data }) => {
  let db;
  try {
    const SQL = await ready;
    db = new SQL.Database();
    seed(db, data.stock, data.market);
    self.postMessage({ id: data.id, result: query(db, data.sql) });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  } finally {
    db?.close();
  }
};
