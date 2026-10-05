# Repository knowledge

Read `docs/CHALLENGE.md` for the source requirements. This repository is a small monorepo: `backend/` is a Ruby 3.4.3 / Rails 8.0.2 API with SQLite; `frontend/` is React 19 with Vite and strict TypeScript. The root npm package manages the frontend workspace. Keep setup manual and straightforward; Docker or process orchestration must not be required.

## Challenge concepts

- A user has a nonnegative integer points balance.
- Rewards have a positive integer points cost and can be deactivated.
- A redemption belongs to a user and a reward. Preserve its reward name and points spent as historical snapshots so later reward edits do not rewrite history.
- The four required use cases are viewing a balance, listing available rewards, redeeming a reward, and viewing redemption history.
- Redemption deducts points and creates history atomically, rejecting insufficient funds and inactive rewards. Preserve concurrency safety; never trust a cost or balance sent by the client.
- No authentication is implemented. The `x-user` header selects a demo identity and is not authorization; keep this assumption explicit in the interface and documentation.

## Current implementation

The Rails backend implements balance, active rewards, atomic redemption writes, and redemption history, plus migrations, models, idempotent development seeds, and a health endpoint. The React frontend implements Overview, Rewards, Redemption (confirmation and success), and History, including loading, error, empty, and insufficient-points states. Backend and frontend tests cover these flows. UI design references live in `docs/mockups/`; `docs/API_SPEC.md` documents the implemented API contract.

Redemption uses a SQLite `BEGIN IMMEDIATE` transaction with fresh reads and a required UUID v4 `Idempotency-Key`. Successful replays return the saved redemption and transaction balance without another debit. The SQLite adapter waits for a write lock using the configured 5-second timeout; the application makes one transaction attempt and returns `503` on busy/locked failure after rollback. Clients retry unresolved requests with the same identity, reward, and key. The frontend persists unresolved attempts in tab-scoped `sessionStorage` and offers an explicit retry without automatically retrying POST.

## Working conventions

- Rails commands run from `backend/`; use `bin/rails`. SQLite database files live in `backend/storage/` and are ignored.
- Run `npm install` at the root and `npm run dev` for Vite. Its development proxy forwards `/api` and `/up` to Rails on port 3000.
- `npm run build` checks TypeScript and produces the frontend bundle. Keep exact package versions and the npm lockfile reproducible.
- Use migrations for schema changes; use model validations plus database constraints for data invariants. Do not edit generated schema by hand.
- Use targeted Rails tests for balance, redemption atomicity, insufficient points, availability, historical snapshots, idempotency, and contention when changing writes.
- Keep the full native AI session export under `ai-session/`, or record prompts as work occurs if the tool cannot export a session. The challenge explicitly requires this folder in the submission.
- Submit a zip containing source, documentation, and `ai-session/`; exclude dependencies, generated bundles, and local database files.
