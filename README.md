# Goblin Order Rush

A CSS-first arcade game for learning beginner SQL. Fulfill goblin orders by querying a real SQLite inventory in your browser.

## Play

A run begins with three shuffled, untimed beginner inquiries. Then customers either browse or buy. Purchases ask for named items or baskets of 3–6 items (or fewer when matching stock runs low), selected with SQL; **Sell order** removes them and pays their price plus a streak tip. **Answer inquiry** pays a tip without changing inventory. Sold items disappear from both SQL results and the ledger.

The first shift starts with 16 items, four per category; later shifts start with 24 items, six per category, with randomized item selection, prices, and curse status. Orders are generated from remaining stock, with purchases guaranteed near sellout. Empty shelves unlock a shift summary and **Start next shift**. Gold, remaining hearts, and streak carry over. After the first three inquiries, shift one contains only purchases: varied categories, cursed or uncursed goods, price limits, and whole-shop shopping, named shopping lists, with cheapest-first or most-expensive-first requests. Broad filters keep baskets substantial, so an error-free first shift takes 6–9 orders including its three introductory inquiries. The new shift starts with 80 seconds of patience, and gets no new untimed orders. Three lost hearts end the entire run. Practice stays untimed with no lost hearts.

Difficulty progresses through four tiers: category filtering and sorting; AND plus COUNT inquiries; BETWEEN plus GROUP BY inquiries; then parenthesized OR/AND combinations. Later shifts keep the fourth tier and generate fresh stock and requests. Hints and the ledger explain the current concepts.

Every three correct answers raises the tip multiplier and reduces future patience by 10 seconds, down to 30. A missed customer resets the streak and restores patience to 80 seconds. A named timeout notice pauses until acknowledged. Wrong answers reset the streak but do not consume stock or restore patience. Changing mode starts a new run. Reloading also starts over; only arcade high scores persist on the device.

Answers are graded by results, accepting alternate correct SQL and column order. Purchases explicitly request sorting by price then name alphabetically to resolve ties. Aggregate inquiries specify their output column names. The first three untimed orders apply only to the beginning of a run.

## Hidden black market

Item IDs remain internal; the ledger and query tables expose `name`, `category`, `price`, and `cursed`. Names are unique. Named purchases teach `WHERE name = '…'` and `WHERE name IN ('…', '…')`, with no consecutive named-order templates.

Shift 2 introduces one black-market inquiry. Its stock has no visible ledger: discover it with `SELECT * FROM black_market;` in the spellbook. The table has the same four columns as inventory, with eight randomized offers each shift.

From shift 3 onward, one delivery opportunity asks for up to three cheapest market items in categories currently stocked. Players explore the market and use `JOIN inventory ON ...category = ...category` plus `DISTINCT` to find eligible goods. **Import stock** transfers the matching rows into the ledger on consignment and removes them from the market; customers can then buy them. The SELECT/JOIN itself never mutates stock. An import earns the usual tip, costs no gold, and is limited to one opportunity per shift. Timing out skips that opportunity. Unsourced market stock does not block completing a shift. All later shifts remain timed in arcade mode.

## Develop

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
```

Vite builds a static site into `dist/`. SQL.js and its WebAssembly binary are bundled locally. Queries run in a worker with a four-second timeout against a read-only snapshot of current stock. Inventory mutations are controlled by the game after a successful sale. Worker recovery cannot restore sold stock. No account, API key, backend, or external database is needed. Fonts use Google Fonts with local fallback fonts. Portraits are system emoji; no generated art is required.

## GitHub Pages

Create a public repository named `goblin-order-rush`, push this project to its `main` branch, and choose **Settings → Pages → Build and deployment → Source → GitHub Actions**. The included workflow tests, builds, and deploys the game. Relative asset paths support repository Pages URLs.

## Files

- `src/game.js`: inventory, order templates, SQLite query handling, result comparison.
- `src/sql-worker.js`: isolated SQLite worker.
- `src/main.js`: game state and interface.
- `src/style.css`: responsive goblin shop theme.
- `tests/game.test.js`: meaningful query and grading tests.

## Scope

One unit per inventory row. No accounts, server, online leaderboard, or player-written mutation queries. The game remains a static GitHub Pages app.
