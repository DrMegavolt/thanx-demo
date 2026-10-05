# Thanx rewards

Monorepo for the rewards challenge in `docs/CHALLENGE.md`.

- `backend/`: Ruby **3.4.3**, Rails **8.0.2**, SQLite API, models, migrations, and demo seeds.
- `frontend/`: React **19.3.0**, Vite **8.3.2**, TypeScript **7.0.2**.
- [`docs/mockups/README.md`](docs/mockups/README.md): design references for the required user flows.
- [`docs/API_SPEC.md`](docs/API_SPEC.md): contract for all four implemented API operations, using the `x-user` demo identity header, with request/response examples and errors.

The React frontend implements the balance overview, rewards catalog, redemption confirmation and success flow, and redemption history using the API spec. The Rails backend implements all four operations, strict validation, atomic redemption, and the error contract. Backend integration tests exercise Rails directly; browser verification against a live server remains separate from the frontend checks below.

## Run locally

Install Ruby 3.4.3 with your preferred Ruby version manager and Node.js 22.12 or newer. The `.ruby-version` files pin Ruby; `.nvmrc` selects Node 22. Use two terminals.

Backend:

```sh
cd backend
ruby --version # Must show 3.4.3
gem install bundler
bundle install
bin/rails db:prepare
bin/rails server
```

Frontend, from the repository root:

```sh
npm install
npm run dev
```

Open http://localhost:5173. Rails runs on http://localhost:3000. Vite proxies API requests during development, so a separate CORS configuration is unnecessary for local development. After changing migrations, run `bin/rails db:migrate` from `backend/`. Seeds can be rerun with `bin/rails db:seed` without resetting balances or duplicating rewards. Seeds refresh the six demo rewards by stable ID; existing redemption snapshots are preserved.

`db:prepare` creates the database, applies the initial migrations, and loads seeds on first setup. The generated `backend/db/schema.rb` should be committed after running migrations with the required Ruby version.

## API

See [the API specification](docs/API_SPEC.md) for all four operations, endpoint paths, request/response examples, validation rules, and error codes. It is the authoritative contract for the implemented backend.

Every `/api` operation requires `x-user: <positive user ID>`. This selects a demo identity and provides no authentication or authorization: any caller can select any existing user. Legacy user-ID routes return 404. The operational health check at `GET /up` needs no header.

On a fresh database, the initial seed user is Alex Morgan with 1,250 points and ID 1; inspect `User.find_by!(name: "Alex Morgan").id` in `bin/rails console` if needed. User ID 2 is Ruby Jones, seeded with 1,250 remaining points and two redemptions (Free coffee and $10 off your order). User ID 3 is Casey Taylor, with zero points and empty redemption history. Rewards are a shared catalog available to all users. Rerunning seeds preserves existing users and history while refreshing the demo catalog. See `backend/db/seeds.rb` for the demo catalog.

Redemption disables Rails' query cache and reads fresh user/reward state inside a Rails 8 SQLite `BEGIN IMMEDIATE` transaction. SQLite's database write lock coordinates other redemptions and reward edits across connections and processes. The debit and historical name/cost snapshots commit together. The SQLite adapter waits for a write lock using the configured 5-second timeout. Busy/locked failures roll back and return 503 without a charge or history entry; the application does not retry the transaction. Other failures return a sanitized 500. Database constraints enforce integer, nonnegative balances and positive costs/spends, alongside model validations.

Redemption POST requires a frontend-generated UUID v4 in `Idempotency-Key`. A unique `(user_id, idempotency_key)` index and the locked transaction ensure duplicate/retried requests charge once. Replays return the original redemption and saved transaction balance; reusing a committed key for another reward returns 409. See the [API specification and flow diagram](docs/API_SPEC.md#idempotency-key-flow) for key scope, retention, errors, and recovery.

## Frontend behavior

`App.tsx` composes the interface and hash navigation. `hooks/useRewardsData.ts` owns API reads, demo identity, refreshes, and request cancellation. `hooks/useRedemption.ts` uses a reducer for saved attempts, pending requests, errors, and success. `components/IdentityMenu.tsx` owns the identity form; `pages/` contains Overview, Rewards, Redemption, and History, with shared reward cards and artwork in `components/`.

Navigate between Overview, Rewards, and History, or open a confirmation directly at `/#/rewards/<reward_id>`. The frontend sends `Accept: application/json` and `x-user` on all API requests; redemption sends only `{ "reward_id": <id> }` with JSON content type and an `Idempotency-Key` header. It starts with demo user ID `1`, or restores the saved attempt’s user after a refresh. Open the user menu to select another existing ID. This is a demo identity selector, not authentication or authorization; any caller can select any existing user.

Balance, rewards, and history come from the API. Confirmation shows the server balance and cost, prevents repeated submissions while pending, and displays success only after POST succeeds. Successful redemption refreshes all three reads. Before POST, the frontend persists `{ userId, rewardId, key }` in tab-scoped `sessionStorage`. Refreshes and navigation preserve unresolved attempts. After a network failure, malformed response, or 5xx, “Retry saved redemption” sends the original identity, reward, and UUID, even if the current catalog or balance no longer permits a new purchase. Reads never clear an unresolved key. A confirmed success or definitive validation/domain rejection clears it; the next user-confirmed purchase gets a new UUID. New purchases and identity changes are blocked while unresolved, and POST is never automatically retried. Insufficient points, unavailable rewards, loading, fetch failures with retry, and empty collections have explicit UI states. Historical reward names and costs use the stored snapshots, and timestamps display in the browser's local timezone.

Layouts follow `docs/mockups/`: ivory surfaces, plum actions, peach accents, and responsive cards. Illustrative photos are cropped from the supplied catalog mockup into six individual `frontend/public/reward_{id}.png` files. Each card loads only its own image; reward names and descriptions come from the API. Add a matching image file for a new reward ID. Missing images use a neutral illustration. No image service or additional frontend dependencies are required.

Frontend verification on October 4, 2026: `npm run build` passes. A headless Chrome check with intercepted API responses covered navigation, the success/history flow, one POST while pending, insufficient points, recovery after a lost response, missing rewards, empty rewards/history, and a 390px layout with no horizontal overflow. These checks verify frontend behavior against the contract; live Rails integration remains unverified in this frontend session.

## Checks

Prettier formats frontend TypeScript, JSX, CSS, and configuration files. Run `npm run format` to apply formatting or `npm run format:check` to verify it; the frontend CI workflow also checks formatting. Its exact version is pinned in the workspace manifest and root lockfile.

```sh
# Repository root
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
# Optional: npm run test:watch
# Format frontend code and styles: npm run format

# backend/
bundle install
bundle exec rubocop
RAILS_ENV=test bin/rails db:prepare
RAILS_ENV=test bin/rails zeitwerk:check
RAILS_ENV=test COVERAGE=1 bin/rails test
```

Frontend tests use Vitest, React Testing Library, and jsdom. They exercise the real API client with mocked HTTP responses: navigation, balance, affordability, historical snapshots, demo identity changes, stale request cancellation, successful redemption, duplicate-submit prevention, API rejections, saved request persistence, and retrying ambiguous failures with the same idempotency key. They run without Rails or a browser installation; live browser/API verification remains a separate check.

`npm run lint` uses Oxlint's correctness rules with TypeScript, React Hooks, accessibility, and Vitest checks. `npm run typecheck` checks application code, tests, and both Vite/Vitest configurations. Coverage includes frontend source except the bootstrap entry point, declarations, and test helpers. `npm run test:coverage` enforces 90% lines/statements/functions and 80% branches, writing HTML, LCOV, and JSON summary reports to ignored `frontend/coverage/`.

Backend lint uses the Rails Omakase RuboCop preset, preserving the existing array spacing style and excluding generated schema and dependency files. Ruby has no configured static type checker; RuboCop checks Ruby syntax and Rails conventions, while `zeitwerk:check` verifies application autoloading.

The frontend build is a static bundle. A production deployment must serve it and route `/api` to Rails; Vite's proxy is development-only. Rails production also requires `SECRET_KEY_BASE` and a writable SQLite database path (`DATABASE_PATH` can override it).

Backend verification on October 4, 2026 uses Ruby 3.4.3 and Rails 8.0.2: migrations and `zeitwerk:check` pass. Tests cover model/database invariants, all API operations/errors, validation precedence, user isolation, historical snapshots, rollback before/after history insertion, single-attempt contention handling, real SQLite contention, concurrent HTTP redemptions, concurrent reward edits, and stale query-cache state.

`COVERAGE=1 bin/rails test` measures executable lines in `backend/app/` and the API body middleware using Ruby's built-in Coverage library. It writes ignored `backend/coverage/coverage.json` and fails below 95% or when an application file was not loaded. Run the full suite for coverage. Minitest is pinned to 5.25.4 for Rails 8 and its bundled mocking helpers.

Both GitHub workflows run on pushes, pull requests, and manual dispatch, with read-only repository permissions and no secrets or database service:

- [Frontend](.github/workflows/frontend.yml): installs Node from `.nvmrc` and dependencies with `npm ci`, then runs lint, type checking, tests with coverage gates, and the production build. Uploads frontend coverage reports.
- [Backend](.github/workflows/backend.yml): installs Ruby 3.4.3 with cached locked gems, runs RuboCop, prepares SQLite, checks autoloading, and runs the complete test suite with the 95% coverage gate. Uploads backend coverage JSON.

See [GitHub Actions](https://github.com/DrMegavolt/thanx-demo/actions) for workflow runs and uploaded reports. Both workflows retain coverage artifacts for 14 days, including reports produced by a failed coverage gate.

## Submission

Include the full native AI session export in `ai-session/` as required by the challenge. If an export is unavailable, record prompts there as work occurs. Submit a zip and exclude `node_modules`, build output, and local databases. See `AGENTS.md` for repository conventions and current implementation details.

See [`ai-session/README.md`](ai-session/README.md) for the captured session files. Frontend package versions were verified on October 4, 2026 using the npm registry: [React](https://registry.npmjs.org/react/latest), [Vite](https://registry.npmjs.org/vite/latest), [TypeScript](https://registry.npmjs.org/typescript/latest), and `npm view @vitejs/plugin-react version`. Exact versions are recorded in the workspace package manifest and root lockfile.
