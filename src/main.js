import "./style.css";
import {
  orderFor,
  sameResult,
  inventory,
  createOpeningOrders,
  isUntimed,
  patienceAfterSuccess,
  patienceAfterLifeLost,
} from "./game.js";
const $ = (id) => document.getElementById(id);
let worker,
  pending = new Map(),
  requestId = 0;
function startWorker() {
  worker = new Worker(new URL("./sql-worker.js", import.meta.url), {
    type: "module",
  });
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(data.id);
    data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
  };
  worker.onerror = () =>
    resetWorker("The SQL engine could not load. Refresh the page to retry.");
}
function resetWorker(message) {
  worker.terminate();
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(new Error(message));
  }
  pending.clear();
  startWorker();
}
function execute(sql) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const timer = setTimeout(
      () => resetWorker("That query took too long. Try a simpler query."),
      4000,
    );
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, sql });
  });
}
startWorker();
let best = 0;
try {
  best = Number(localStorage.getItem("goblin-best")) || 0;
} catch {}
let state = {
  index: 0,
  opening: createOpeningOrders(),
  departed: null,
  score: 0,
  streak: 0,
  hearts: 3,
  mode: "arcade",
  paused: false,
  over: false,
  remaining: 90,
  patience: 90,
  roundPatience: 90,
  busy: false,
  result: null,
  sqlRun: "",
  hints: 0,
  generation: 0,
};
const patrons = [
  "Grub · amateur treasure hunter",
  "Midge · potion enthusiast",
  "Boggs · financially responsible goblin",
  "Nettle · collector of oddities",
  "Crumb · definitely not three rats",
];
$("app").innerHTML =
  `<main class="shell"><header><div class="brand"><div class="mark" aria-hidden="true">G</div><div><h1>Goblin Order Rush</h1><p>A little shop. A lot of suspicious inventory.</p></div></div><div class="stats"><div class="stat"><span>Gold earned</span><strong class="coins" id="score">0</strong></div><div class="stat"><span>Streak</span><strong id="streak">×1</strong></div><div class="stat"><span>Hearts</span><strong class="hearts" id="hearts" aria-label="3 hearts">♥ ♥ ♥</strong></div></div></header><div class="toolbar"><div class="toolbar-left"><span class="eyebrow"><i class="dot"></i>Shop is open</span><label><span class="tag">Mode </span><select id="mode" aria-label="Game mode"><option value="arcade">Arcade shift</option><option value="practice">Untimed practice</option></select></label></div><button id="pause">Pause</button></div><section class="order" aria-labelledby="order-text"><div class="portrait" aria-hidden="true">🧌</div><div class="order-copy"><div class="eyebrow" id="patron"></div><h2 id="order-text"></h2><div class="patience-line"><span id="lesson"></span><span id="time"></span></div><div class="meter" role="progressbar" aria-label="Customer patience" aria-valuemin="0" aria-valuemax="90" aria-valuenow="90"><div id="meter"></div></div></div></section><div class="workspace"><div><section class="panel"><div class="panel-head"><h3>Your spellbook</h3><span class="tag">SQL / inventory</span></div><div class="editor-wrap"><div class="line-numbers" aria-hidden="true">1\n2\n3\n4\n5</div><textarea id="sql" aria-label="SQL query" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></div><div class="editor-actions"><button class="quiet" id="hint">✧ Need a hint?</button><div><span class="shortcut">⌘ / Ctrl + Enter</span><button class="primary" id="run">Run query ↗</button></div></div><div class="hint" id="hint-text" hidden></div></section><section class="panel result-panel"><div class="panel-head"><h3>The counter</h3><span class="tag" id="row-count">No items yet</span></div><div id="results" class="table-scroll"><div class="empty">Run a query to put items on the counter.</div></div><div class="result-foot"><div role="status" aria-live="polite" class="feedback" id="feedback">Return all columns with SELECT *.</div><button class="gold" id="serve" disabled>Serve order →</button><button class="primary" id="next" hidden>Next customer →</button></div></section></div><aside class="panel"><div class="panel-head"><h3>Shop ledger</h3><span class="tag">40 items</span></div><div class="schema"><p class="schema-title">▦ inventory</p><div class="schema-row"><span>id</span><span>INTEGER</span></div><div class="schema-row"><span>name</span><span>TEXT</span></div><div class="schema-row"><span>category</span><span>TEXT</span></div><div class="schema-row"><span>price</span><span>INTEGER</span></div><div class="schema-row"><span>cursed</span><span>0 or 1</span></div><div class="note">Categories: <b>potion, weapon, charm, snack</b><br>Prices are in gold. Cursed: 1 = yes, 0 = no.</div><details><summary>Peek inside the ledger</summary><div class="table-scroll" id="inventory"></div></details></div><div class="recipe"><h3>A tiny SQL recipe</h3><p><code>SELECT *</code> — choose every column<br><code>FROM inventory</code> — pick the table<br><code>WHERE price &lt; 20</code> — filter items<br><code>ORDER BY price ASC</code> — cheapest first<br><code>LIMIT 3</code> — take three rows</p><p>Text goes in single quotes:<br><code>WHERE category = 'potion'</code></p></div><div class="recipe"><h3>How the shift works</h3><p>Read the order, query the ledger, then serve. The first three orders mix basic SQL skills in a random order and have endless patience. Order 4 starts with 80 seconds. Each multiplier increase cuts patience by 10 seconds, down to 30. Losing a heart resets patience to 80 seconds.</p><p>Every three correct orders raises your multiplier. Miss three customers and the shift ends. Practice has no timer or lost hearts.</p></div></aside></div><footer><span>Made for curious goblins. No SQL experience needed.</span><span id="best"></span></footer></main><div class="overlay" id="overlay" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><span class="eyebrow">Goblin Order Rush</span><h2 id="modal-title"></h2><p id="modal-copy"></p><button class="primary" id="resume"></button></section></div>`;
function table(result) {
  const table = document.createElement("table");
  const head = table.createTHead().insertRow();
  for (const col of result.columns) {
    const th = document.createElement("th");
    th.textContent = col;
    head.append(th);
  }
  const body = table.createTBody();
  for (const row of result.values) {
    const tr = body.insertRow();
    for (const val of row)
      tr.insertCell().textContent = val === null ? "NULL" : String(val);
  }
  return table;
}
$("inventory").append(
  table({
    columns: ["name", "price", "cursed"],
    values: inventory.map((r) => [r.name, r.price, r.cursed]),
  }),
);
let order,
  expected,
  served = false;
function feedback(text, error = false) {
  $("feedback").textContent = text;
  $("feedback").classList.toggle("error", error);
}
function stats() {
  $("score").textContent = state.score;
  $("streak").textContent = `×${1 + Math.floor(state.streak / 3)}`;
  $("hearts").textContent =
    state.mode === "practice"
      ? "∞"
      : Array.from({ length: 3 }, (_, i) =>
          i < state.hearts ? "♥" : "♡",
        ).join(" ");
  $("hearts").setAttribute(
    "aria-label",
    state.mode === "practice" ? "Unlimited hearts" : `${state.hearts} hearts`,
  );
  $("best").textContent = `Arcade best: ${best} gold`;
}
function timerUI() {
  const untimed = isUntimed(state.index, state.mode);
  $("time").textContent = untimed
    ? "Take your time"
    : `${Math.ceil(state.remaining)}s patience`;
  $("meter").style.width =
    `${untimed ? 100 : (state.remaining / state.roundPatience) * 100}%`;
  document
    .querySelector(".meter")
    .setAttribute("aria-valuemax", state.roundPatience);
  document
    .querySelector(".meter")
    .setAttribute(
      "aria-valuenow",
      untimed ? state.roundPatience : Math.ceil(state.remaining),
    );
}
async function nextOrder() {
  const generation = ++state.generation;
  order = orderFor(state.index, Math.random, state.opening);
  served = false;
  state.roundPatience = state.patience;
  state.remaining = state.roundPatience;
  state.result = null;
  state.sqlRun = "";
  state.hints = 0;
  state.busy = true;
  expected = null;
  $("sql").value = order.starter;
  $("sql").disabled = false;
  $("patron").textContent = patrons[state.index % patrons.length];
  $("order-text").textContent = order.text;
  $("lesson").textContent =
    state.index < 3
      ? `Apprentice order ${state.index + 1}/3 · ${order.concept}`
      : `Order ${state.index + 1} · ${order.concept}`;
  $("hint-text").hidden = true;
  $("hint").textContent = "✧ Need a hint?";
  $("next").hidden = true;
  $("serve").hidden = false;
  $("serve").disabled = true;
  $("run").disabled = true;
  $("results").innerHTML =
    '<div class="empty">Run a query to put items on the counter.</div>';
  $("row-count").textContent = "No items yet";
  feedback("Return all columns with SELECT *.");
  timerUI();
  try {
    const result = await execute(order.sql);
    if (generation !== state.generation) return;
    expected = result;
  } catch (e) {
    feedback(e.message, true);
  } finally {
    if (generation === state.generation) {
      state.busy = false;
      $("run").disabled = !expected;
    }
  }
}
async function run() {
  if (state.busy || state.paused || state.over || served || !expected) return;
  state.busy = true;
  $("run").disabled = true;
  $("serve").disabled = true;
  const generation = state.generation;
  const sql = $("sql").value;
  try {
    const result = await execute(sql);
    if (generation !== state.generation) return;
    state.result = result;
    state.sqlRun = sql;
    $("results").replaceChildren(table(result));
    $("row-count").textContent =
      `${result.values.length} item${result.values.length === 1 ? "" : "s"}`;
    feedback("Query complete. Ready to serve?");
    $("serve").disabled = $("sql").value !== sql;
  } catch (e) {
    if (generation === state.generation) {
      state.result = null;
      feedback(e.message, true);
    }
  } finally {
    if (generation === state.generation) {
      state.busy = false;
      $("run").disabled = false;
    }
  }
}
function saveBest() {
  if (state.mode === "arcade" && state.score > best) {
    best = state.score;
    try {
      localStorage.setItem("goblin-best", String(best));
    } catch {}
  }
}
function showModal(over) {
  $("modal-title").textContent = over
    ? "That’s a shift!"
    : state.departed
      ? "Customer left"
      : "Shop on a break";
  const departure = state.departed
    ? `${state.departed} got tired of waiting and left. `
    : "";
  $("modal-copy").textContent = over
    ? `${departure}You earned ${state.score} gold. Ready for another shift?`
    : state.departed
      ? `${departure}Onto the next order. Your next customer has 80 seconds of patience.`
      : "Your customers can wait. Come back when you’re ready.";
  $("resume").textContent = over
    ? "Start a new shift"
    : state.departed
      ? "Next order →"
      : "Back to the counter";
  $("overlay").hidden = false;
  document.querySelector(".shell").inert = true;
  $("resume").focus();
}
function miss() {
  if (state.paused || state.over) return;
  state.departed = patrons[state.index % patrons.length].split(" · ")[0];
  state.paused = true;
  state.hearts--;
  state.patience = patienceAfterLifeLost();
  state.streak = 0;
  state.index++;
  state.over = state.hearts <= 0;
  saveBest();
  stats();
  showModal(state.over);
}
$("run").onclick = run;
$("sql").addEventListener("input", () => {
  $("serve").disabled = true;
});
$("sql").addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    run();
  }
});
$("serve").onclick = () => {
  if (
    !state.result ||
    state.sqlRun !== $("sql").value ||
    served ||
    state.over ||
    state.paused
  )
    return;
  if (sameResult(state.result, expected, order.ordered)) {
    served = true;
    state.streak++;
    state.patience = patienceAfterSuccess(state.patience, state.streak);
    const earned = 10 * (1 + Math.floor((state.streak - 1) / 3));
    state.score += earned;
    saveBest();
    stats();
    feedback(`“Exactly what I wanted!” +${earned} gold`);
    $("serve").hidden = true;
    $("next").hidden = false;
    $("run").disabled = true;
    $("sql").disabled = true;
    $("next").focus();
  } else {
    state.streak = 0;
    stats();
    feedback(
      `Not quite. Check the columns, filters${order.ordered ? ", sorting, and limit" : ""}. You can try again.`,
      true,
    );
  }
};
$("next").onclick = () => {
  state.index++;
  nextOrder();
  $("sql").focus();
};
$("hint").onclick = () => {
  state.hints++;
  $("hint-text").hidden = false;
  $("hint-text").textContent =
    state.hints === 1 ? order.hint : `One solution: ${order.sql}`;
  $("hint").textContent =
    state.hints === 1 ? "Show a solution" : "Solution shown";
};
function restart() {
  state = {
    ...state,
    index: 0,
    opening: createOpeningOrders(),
    departed: null,
    score: 0,
    streak: 0,
    hearts: 3,
    patience: 90,
    paused: false,
    over: false,
    busy: false,
  };
  $("overlay").hidden = true;
  document.querySelector(".shell").inert = false;
  stats();
  nextOrder();
}
$("mode").onchange = () => {
  state.mode = $("mode").value;
  restart();
};
$("pause").onclick = () => {
  if (state.over) return;
  state.paused = true;
  showModal(false);
};
$("resume").onclick = () => {
  if (state.over) restart();
  else {
    state.paused = false;
    $("overlay").hidden = true;
    document.querySelector(".shell").inert = false;
    if (state.departed) {
      state.departed = null;
      nextOrder();
    }
    $("sql").focus();
  }
};
$("overlay").addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    $("resume").focus();
  }
  if (e.key === "Escape" && !state.over) $("resume").click();
});
let previous = performance.now();
setInterval(() => {
  const now = performance.now();
  const delta = (now - previous) / 1000;
  previous = now;
  if (
    !isUntimed(state.index, state.mode) &&
    !state.paused &&
    !state.over &&
    !state.busy &&
    !served &&
    expected
  ) {
    state.remaining = Math.max(0, state.remaining - delta);
    timerUI();
    if (state.remaining === 0) miss();
  }
}, 200);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !state.over && !state.paused) {
    state.paused = true;
    showModal(false);
  }
});
stats();
nextOrder();
