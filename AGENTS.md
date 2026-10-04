# Repository knowledge

Read `docs/CHALLENGE.md` for the source requirements. This repository is a small monorepo: `backend/` is a Ruby 3.4.3 / Rails 8.0.2 API with SQLite; `frontend/` is React 19 with Vite and strict TypeScript. The root npm package manages the frontend workspace. Keep setup manual and straightforward; Docker or process orchestration must not be required.

## Challenge concepts

- A user has a nonnegative integer points balance.
- Rewards have a positive integer points cost and can be deactivated.
- A redemption belongs to a user and a reward. Preserve its reward name and points spent as historical snapshots so later reward edits do not rewrite history.
- The four required use cases are viewing a balance, listing available rewards, redeeming a reward, and viewing redemption history.
- Redemption must eventually deduct points and create history atomically, rejecting insufficient funds and inactive rewards. Account for concurrent requests; never trust a cost or balance sent by the client.
- No authentication is implemented in the scaffold. A user identifier is not authorization; document the demo identity assumption when implementing the interface.

## Current implementation

The scaffold provides migrations, models, idempotent development seeds, health and read-only API endpoints. Redemption writes and the four functional UI screens are future implementation work. UI design references live in `docs/mockups/`. Do not describe the scaffold as a completed challenge implementation.

## Working conventions

- Rails commands run from `backend/`; use `bin/rails`. SQLite database files live in `backend/storage/` and are ignored.
- Run `npm install` at the root and `npm run dev` for Vite. Its development proxy forwards `/api` and `/up` to Rails on port 3000.
- `npm run build` checks TypeScript and produces the frontend bundle. Keep exact package versions and the npm lockfile reproducible.
- Use migrations for schema changes; use model validations plus database constraints for data invariants. Do not edit generated schema by hand.
- Use targeted Rails tests for balance, redemption atomicity, insufficient points, availability, and historical snapshots when implementing writes.
- Keep the full native AI session export under `ai-session/`, or record prompts as work occurs if the tool cannot export a session. The challenge explicitly requires this folder in the submission.
- Submit a zip containing source, documentation, and `ai-session/`; exclude dependencies, generated bundles, and local database files.
