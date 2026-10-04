# Rewards API specification

This is the implemented backend API contract for all four use cases in [CHALLENGE.md](CHALLENGE.md): view a points balance, browse rewards, redeem a reward, and view redemption history. Authentication is out of scope. The backend implements this contract and tests it with Rails integration tests.

## Conventions and demo identity

- Base URL for local Rails: `http://localhost:3000`. The frontend can use relative `/api` URLs through the Vite development proxy.
- All `/api` requests require `x-user: <user_id>`. Header names are case-insensitive. The value must be one positive decimal integer (for example, `1`), without signs, leading zeros, or multiple values. The referenced user must exist.
- `x-user` selects the demo user; it is not authentication or authorization. Any caller can choose any existing user ID. Balance and history are always scoped to this header, and redemption always debits this user. User IDs are not accepted in paths or request bodies in this proposed contract.
- Responses use `Content-Type: application/json`. POST requests must use `Content-Type: application/json` (an optional charset parameter is allowed). Clients should send `Accept: application/json`.
- JSON field names use `snake_case`. IDs, balances, costs, and points spent are JSON integers. Balances are nonnegative; costs and points spent are positive. Timestamps are ISO 8601 strings in UTC.
- Collection responses are arrays, with `[]` for an empty collection. Pagination, filtering, reward administration, and user administration are outside the challenge scope.
- Examples below are illustrative; balances and records depend on the current database state.

## Endpoints

| Use case | Method | Path | Success |
| --- | --- | --- | --- |
| View the selected user's balance | GET | `/api/balance` | `200 OK` |
| Browse active rewards | GET | `/api/rewards` | `200 OK` |
| Redeem a reward for the selected user | POST | `/api/redemptions` | `201 Created` |
| View the selected user's redemption history | GET | `/api/redemptions` | `200 OK` |

### GET /api/balance

No request body or query parameters. Returns the current stored points balance and basic demo-user information.

```http
GET /api/balance
x-user: 1
Accept: application/json
```

```json
{
  "user_id": 1,
  "name": "Alex Morgan",
  "points_balance": 1250
}
```

Errors: `400 missing_user_header`, `400 invalid_user_header`, `404 user_not_found`.

### GET /api/rewards

No request body or query parameters. Returns all active rewards, ordered by `points_cost` ascending, then `id` ascending. Availability means active, regardless of whether the selected user can afford the reward. Inactive rewards are excluded. The client can compare costs with `/api/balance`; a listed reward can still become unavailable before redemption.

```http
GET /api/rewards
x-user: 1
Accept: application/json
```

```json
[
  {
    "id": 1,
    "name": "Free coffee",
    "description": "One complimentary coffee.",
    "points_cost": 250
  }
]
```

`description` is a string or `null`. Each reward includes only the four fields shown above.

Errors: `400 missing_user_header`, `400 invalid_user_header`, `404 user_not_found`.

### POST /api/redemptions

Creates one redemption using the selected user's points. The body must be a JSON object containing exactly one required field, `reward_id`, whose value is a positive JSON integer. Strings, fractions, booleans, `null`, missing fields, and additional fields are rejected. Client-supplied identity, balance, cost, and snapshot fields are never used.

```http
POST /api/redemptions
x-user: 1
Content-Type: application/json
Accept: application/json

{"reward_id": 1}
```

Success: `201 Created`.

```json
{
  "redemption": {
    "id": 42,
    "reward_id": 1,
    "reward_name": "Free coffee",
    "points_spent": 250,
    "created_at": "2026-10-04T20:00:00.000Z"
  },
  "points_balance": 1000
}
```

The response balance is the result of this transaction; a later concurrent transaction can change it again. The redemption object has the same fields as a history entry.

Required write behavior:

1. Resolve the user from `x-user` and validate the request body.
2. Read the reward from the database and verify that it exists and is active.
3. Check the stored balance against the stored reward cost; never use a client-supplied balance or cost.
4. Deduct the cost and create the redemption in one database transaction. Store the reward's name as `reward_name` and its cost as `points_spent` at redemption time.
5. Commit both changes before returning success. Any failure rolls back both changes.

Concurrent requests must not overspend or leave a negative balance. The balance check, debit, reward availability/cost read, and history creation must be coordinated so concurrent redemptions or reward edits cannot invalidate the committed result. Use transaction handling appropriate to SQLite; a transaction alone without concurrency protection is insufficient. If transient database contention remains after bounded retries, return `503 service_unavailable` with neither a debit nor a history entry committed by that request.

This endpoint is not idempotent: two successful POST requests create two redemptions and charge twice. Idempotency keys are outside this contract. After a timeout or lost response, clients should refresh balance and history before deciding whether to submit again; they must not automatically retry an ambiguous result.

Errors: identity errors above; `415 unsupported_media_type`; `400 invalid_json`; `422 invalid_request`; `404 reward_not_found`; `422 reward_inactive`; `422 insufficient_points`; and `503 service_unavailable` for exhausted database-contention retries.

### GET /api/redemptions

No request body or query parameters. Returns all redemptions belonging to the user selected by `x-user`, ordered by `created_at` descending, then `id` descending.

```http
GET /api/redemptions
x-user: 1
Accept: application/json
```

```json
[
  {
    "id": 42,
    "reward_id": 1,
    "reward_name": "Free coffee",
    "points_spent": 250,
    "created_at": "2026-10-04T20:00:00.000Z"
  }
]
```

`reward_name` and `points_spent` are historical snapshots. Later changes to a reward's name, cost, or active status do not alter or remove prior history entries. The response includes only the five fields shown above.

Errors: `400 missing_user_header`, `400 invalid_user_header`, `404 user_not_found`.

## Error contract

All API errors use the same JSON envelope. Clients should branch on the HTTP status and stable `error.code`; `message` is human-readable and may change. `details` is always an object, empty when there is no additional context. Never expose stack traces, SQL, or internal exception text.

```json
{
  "error": {
    "code": "insufficient_points",
    "message": "You do not have enough points to redeem this reward.",
    "details": {
      "points_balance": 100,
      "points_required": 250
    }
  }
}
```

| HTTP status | `error.code` | Condition | `details` |
| --- | --- | --- | --- |
| 400 | `missing_user_header` | `x-user` is absent or blank. | `{}` |
| 400 | `invalid_user_header` | `x-user` is not one positive decimal integer in the accepted format. | `{}` |
| 400 | `invalid_json` | POST body is empty or cannot be parsed as JSON. | `{}` |
| 404 | `user_not_found` | A valid `x-user` value does not identify an existing user. | `{}` |
| 404 | `reward_not_found` | A valid `reward_id` does not identify an existing reward. | `{}` |
| 404 | `endpoint_not_found` | No API route exists for the requested path. | `{}` |
| 405 | `method_not_allowed` | Path exists but does not support this HTTP method. Include an `Allow` header with the supported methods. | `{}` |
| 415 | `unsupported_media_type` | POST content type is missing or is not JSON. | `{}` |
| 422 | `invalid_request` | Parsed JSON is not an object, `reward_id` is missing/invalid, or extra fields are supplied. | `{"fields": {"reward_id": ["must be a positive integer"]}}`, or equivalent field messages; use `body` for non-object JSON and the extra field's name for unexpected fields. |
| 422 | `reward_inactive` | The reward exists but is inactive when redemption is attempted. | `{"reward_id": 1}` |
| 422 | `insufficient_points` | Stored balance is lower than the stored reward cost. | `{"points_balance": 100, "points_required": 250}` |
| 503 | `service_unavailable` | Transient database contention remains after bounded retries; this request has committed no changes. | `{}` |
| 500 | `internal_error` | An unexpected server failure occurs. | `{}` |

For matched endpoints, validate identity first (presence, format, then user existence). For POST, then validate media type, JSON syntax, body fields, reward existence, active status, and sufficient points, in that order. Report the first failing category; `invalid_request` may include multiple field errors. Route/method errors are resolved before endpoint validation. No `401` or `403` responses are specified because authentication and authorization are out of scope.

Domain and validation errors do not change points or create history. A `500` or network failure can leave the client uncertain whether a transaction committed; reconcile using balance and history before retrying.

## Legacy scaffold compatibility and health check

The initial scaffold implemented `GET /api/users/:id/balance`, `GET /api/rewards`, and `GET /api/users/:user_id/redemptions`. It selected users from URL parameters, did not enforce `x-user`, and returned a simpler record-not-found error. It had no redemption POST route.

The implementation replaces the user-ID read paths with `/api/balance` and `/api/redemptions`, adds POST redemption, validates the header on all four operations, and adopts the shared error format. Legacy user-ID routes are not part of the proposed contract. This document supersedes the README's earlier planned user-ID redemption route.

`GET /up` is an existing operational Rails health check, outside the four challenge API endpoints. It does not require `x-user`, returns Rails' health response (HTML), and does not use the API error envelope.
