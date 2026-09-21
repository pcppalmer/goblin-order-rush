# Goblin Order Rush

A CSS-first arcade game for learning beginner SQL. Fulfill goblin orders by querying a real SQLite inventory in your browser.

## Play

Read the customer order, edit SQL, run the query, and serve the results. The first five orders introduce SELECT, WHERE, numeric comparisons, AND, and ORDER BY / LIMIT with the first three orders untimed. Order 4 starts at 80 seconds after the first multiplier increase. Every subsequent multiplier increase reduces the next customer’s patience by 10 seconds, down to 30. Losing a life resets patience to 80 seconds, and subsequent multiplier increases shorten it again. Wrong answers reset the streak but do not restore patience. Later orders are randomized. Three missed customers end a shift. Practice mode is untimed. Switching modes starts a fresh shift.

All orders request every inventory column. Correct answers are checked by result, not exact SQL text. Sorting is checked only when an order requests it. Incorrect answers allow retries. Hints progress to an explained example and then a solution. Arcade high scores are stored on this device only.

## Develop

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
```

Vite builds a static site into `dist/`. SQL.js and its WebAssembly binary are bundled locally. Queries run in a worker with a four-second timeout; the database is read-only. No account, API key, backend, or external database is needed. Fonts use Google Fonts with local fallback fonts. Portraits are system emoji; no generated art is required.

## GitHub Pages

Create a public repository named `goblin-order-rush`, push this project to its `main` branch, and choose **Settings → Pages → Build and deployment → Source → GitHub Actions**. The included workflow tests, builds, and deploys the game. Relative asset paths support repository Pages URLs.

## Files

- `src/game.js`: inventory, order templates, SQLite query handling, result comparison.
- `src/sql-worker.js`: isolated SQLite worker.
- `src/main.js`: game state and interface.
- `src/style.css`: responsive goblin shop theme.
- `tests/game.test.js`: meaningful query and grading tests.

## Scope

This first version uses one fixed 40-item inventory and five order templates, with randomized parameters after the introductory sequence. Serving does not remove stock. JOINs, accounts, online leaderboards, sound effects, and generated portraits are not included.
