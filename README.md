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

Open http://localhost:5173. Rails runs on http://localhost:3000. Vite proxies API requests during development, so a separate CORS configuration is unnecessary for local development. After changing migrations, run `bin/rails db:migrate` from `backend/`. Seeds can be rerun with `bin/rails db:seed` without resetting balances or duplicating rewards.

`db:prepare` creates the database, applies the initial migrations, and loads seeds on first setup. The generated `backend/db/schema.rb` should be committed after running migrations with the required Ruby version.

## API

See [the API specification](docs/API_SPEC.md) for all four operations, endpoint paths, request/response examples, validation rules, and error codes. It is the authoritative contract for the implemented backend.

Every `/api` operation requires `x-user: <positive user ID>`. This selects a demo identity and provides no authentication or authorization: any caller can select any existing user. Legacy user-ID routes return 404. The operational health check at `GET /up` needs no header.

On a fresh database, the initial seed user is Alex Morgan with 1,250 points and ID 1; inspect `User.find_by!(name: "Alex Morgan").id` in `bin/rails console` if needed. User ID 2 is Ruby Jones, seeded with 1,250 remaining points and two redemptions (Free coffee and $5 off your order). User ID 3 is Casey Taylor, with zero points and empty redemption history. Rewards are a shared catalog available to all users. Rerunning seeds preserves existing users and history. See `backend/db/seeds.rb` for the demo catalog.

Redemption disables Rails' query cache and reads fresh user/reward state inside a Rails 8 SQLite `BEGIN IMMEDIATE` transaction. SQLite's database write lock coordinates other redemptions and reward edits across connections and processes. The debit and historical name/cost snapshots commit together. Busy/locked failures roll back and retry the complete transaction up to three attempts, with 25ms and 50ms backoff, then return 503 without a charge or history entry. Each attempt also uses the configured 5-second SQLite lock timeout. Other failures return a sanitized 500. Database constraints enforce integer, nonnegative balances and positive costs/spends, alongside model validations.

POST is not idempotent: successful repeated requests charge again. After a network failure or ambiguous 500, refresh balance/history before deciding whether to resubmit.

## Frontend behavior

Navigate between Overview, Rewards, and History, or open a confirmation directly at `/#/rewards/<reward_id>`. The frontend sends `Accept: application/json` and `x-user` on all API requests; redemption sends only `{ "reward_id": <id> }` with JSON content type. It starts with demo user ID `1`. Open the user menu to select another existing ID. This is a demo identity selector, not authentication or authorization; any caller can select any existing user.

Balance, rewards, and history come from the API. Confirmation shows the server balance and cost, prevents repeated submissions while pending, and displays success only after POST succeeds. Successful redemption refreshes all three reads. Network failures and ambiguous server errors block further redemption until the user refreshes and reviews balance and history; POST is never automatically retried. Insufficient points, unavailable rewards, loading, fetch failures with retry, and empty collections have explicit UI states. Historical reward names and costs use the stored snapshots, and timestamps display in the browser's local timezone.

Layouts follow `docs/mockups/`: ivory surfaces, plum actions, peach accents, and responsive cards. Illustrative photos reuse the supplied catalog mockup as a CSS image sheet in `frontend/public/rewards-reference.png`; reward names and descriptions still come from the API. Unknown reward types use a neutral illustration. No image service or additional frontend dependencies are required.

Frontend verification on October 4, 2026: `npm run build` passes. A headless Chrome check with intercepted API responses covered navigation, the success/history flow, one POST while pending, insufficient points, recovery after a lost response, missing rewards, empty rewards/history, and a 390px layout with no horizontal overflow. These checks verify frontend behavior against the contract; live Rails integration remains unverified in this frontend session.

## Checks

```sh
# Repository root
npm run typecheck
npm run build

# backend/
bin/rails db:migrate
bin/rails zeitwerk:check
bin/rails test
COVERAGE=1 bin/rails test
```

The frontend build is a static bundle. A production deployment must serve it and route `/api` to Rails; Vite's proxy is development-only. Rails production also requires `SECRET_KEY_BASE` and a writable SQLite database path (`DATABASE_PATH` can override it).

Backend verification on October 4, 2026 uses Ruby 3.4.3 and Rails 8.0.2: migrations and `zeitwerk:check` pass. Tests cover model/database invariants, all API operations/errors, validation precedence, user isolation, historical snapshots, rollback before/after history insertion, retry recovery, real SQLite contention, concurrent HTTP redemptions, concurrent reward edits, and stale query-cache state.

`COVERAGE=1 bin/rails test` measures executable lines in `backend/app/` and the API body middleware using Ruby's built-in Coverage library. It writes ignored `backend/coverage/coverage.json` and fails below 95% or when an application file was not loaded. Run the full suite for coverage. Minitest is pinned to 5.25.4 for Rails 8 and its bundled mocking helpers.

[`.github/workflows/backend.yml`](.github/workflows/backend.yml) runs on pushes, pull requests, and manual dispatch. It installs Ruby 3.4.3 with cached locked gems, prepares SQLite, checks autoloading, runs the complete test suite with the 95% coverage gate, and uploads the coverage JSON. The workflow has read-only repository permissions and needs no secrets or database service. See [GitHub Actions](https://github.com/DrMegavolt/thanx-demo/actions) for workflow runs and uploaded coverage reports.

## Submission

Include the full native AI session export in `ai-session/` as required by the challenge. If an export is unavailable, record prompts there as work occurs. Submit a zip and exclude `node_modules`, build output, and local databases. See `AGENTS.md` for repository conventions and the remaining challenge behavior.

See [`ai-session/README.md`](ai-session/README.md) for the captured session files. Frontend package versions were verified on October 4, 2026 using the npm registry: [React](https://registry.npmjs.org/react/latest), [Vite](https://registry.npmjs.org/vite/latest), [TypeScript](https://registry.npmjs.org/typescript/latest), and `npm view @vitejs/plugin-react version`. Exact versions are recorded in the workspace package manifest and root lockfile.
