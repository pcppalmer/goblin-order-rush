import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { seed, query } from "./game.js";
const ready = initSqlJs({ locateFile: () => wasmUrl }).then((SQL) => {
  const db = new SQL.Database();
  seed(db);
  return db;
});
self.onmessage = async ({ data }) => {
  try {
    const db = await ready;
    self.postMessage({ id: data.id, result: query(db, data.sql) });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
